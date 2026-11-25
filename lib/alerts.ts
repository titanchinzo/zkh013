import "server-only";
import { connectToDatabase } from "@/lib/mongodb";
import Alert from "@/lib/models/Alert";
import Personnel from "@/lib/models/Personnel";
import { ALERT_LEVEL_MARK, ALERT_RING_MINUTES, alertLevel } from "@/lib/hr";
import { pushToDevices, type PushPayload } from "@/lib/push";

// Товлосон мэдээллийг шалгах давтамж — ALERT_CHECK_MS-ээр өөрчилж болно (туршилтад)
const CHECK_MS = Number(process.env.ALERT_CHECK_MS) || 30_000;
// Улаан мэдээллийг хүлээн аваагүй утсанд ийм давтамжтай дахин мэдэгдэнэ — ALERT_RING_MS (туршилтад)
const RING_EVERY_MS = Number(process.env.ALERT_RING_MS) || 60_000;
const RING_FOR_MS = ALERT_RING_MINUTES * 60_000;

/** Дуусах цаг нь болоогүй (хуучин, хугацаагүй мэдээлэлд endsAt байхгүй) */
export const notExpired = (now = new Date()) => ({ $or: [{ endsAt: null }, { endsAt: { $gt: now } }] });

/** Утсанд харагдах мэдээлэл: эхэлсэн, дуусаагүй */
export const visibleNow = (now = new Date()) => ({
  $and: [{ $or: [{ startsAt: null }, { startsAt: { $lte: now } }] }, notExpired(now)],
});

type AlertPush = { _id: unknown; title: string; body: string; level?: string };

/** Мэдэгдлийн гарчгийн өмнө түвшний тэмдэг; нэг мэдээллийн мэдэгдлүүд tag-аараа нэг нь нөгөөгөө орлоно */
function alertPush(alert: AlertPush): PushPayload {
  const level = alertLevel(alert.level);
  return { title: `${ALERT_LEVEL_MARK[level]} ${alert.title}`, body: alert.body, tag: `alert-${alert._id}`, level };
}

/**
 * Улаан дохио илгээхгүй гэж хүний нөөцийн тэмдэглэсэн хүмүүс (захирагч, орлогч г.м). Улаан мэдээлэл аппад нь энгийн
 * мэдээлэл шиг харагдана: мэдэгдэл, давтан дохио очихгүй, бүтэн дэлгэцийн дохио гарахгүй. Шар, ногоон хэвээр очно.
 */
export async function alarmOffUsers(): Promise<string[]> {
  const people = await Personnel.find({ noAlarm: true, userId: { $nin: [null, ""] } })
    .select("userId")
    .lean<{ userId: string }[]>();
  return people.map((p) => p.userId);
}

/**
 * Эхлэх цаг нь болсон, мэдэгдэл нь хараахан очоогүй мэдээллийг эхлээд «очсон» гэж тэмдэглээд утсанд илгээнэ —
 * хоёр газраас зэрэг дуудсан ч давхар очихгүй. Хуучин мэдээлэлд startsAt байхгүй тул хамаарахгүй.
 */
async function announceOne(filter: Record<string, unknown>, now: Date) {
  const alert = await Alert.findOneAndUpdate(
    { ...filter, notifiedAt: null, startsAt: { $lte: now }, endsAt: { $gt: now } },
    { $set: { notifiedAt: now, rangAt: now } },
    { returnDocument: "after" }
  ).lean<AlertPush>();
  if (!alert) return null;
  const exclude = alertLevel(alert.level) === "red" ? await alarmOffUsers() : undefined;
  return pushToDevices(alertPush(alert), undefined, undefined, { exclude });
}

/** Энэ мэдээллийн эхлэх цаг болсон бол одоо утсанд мэдэгдэнэ: { sent, failed }; товлосон бол null */
export function announceAlert(id: unknown, now = new Date()) {
  return announceOne({ _id: id }, now);
}

/** Эхлэх цаг нь болсон бүх товлосон мэдээллийг илгээнэ (сервер унтарч байсан бол асахдаа) */
export async function sendDueAlerts(now = new Date()) {
  await connectToDatabase();
  let count = 0;
  while (await announceOne({}, now)) count++;
  return count;
}

/**
 * Улаан мэдээлэл: «Хүлээн авлаа» дараагүй хүмүүсийн утсыг эхний мэдэгдлээс хойш ALERT_RING_MINUTES минут дахин дахин
 * дуугаргана. Хүлээн авсан, устгасан, дууссан, түвшнийг нь бууруулсан бол зогсоно. Давтан мэдэгдэл богино ttl-тэй —
 * унтраалттай байсан утас асахад хуучин дохио ирэхгүй (эхний мэдэгдэл нь ирнэ).
 */
export async function ringRedAlerts(now = new Date()) {
  await connectToDatabase();
  const due = new Date(now.getTime() - RING_EVERY_MS);
  let off: string[] | null = null;
  let count = 0;
  for (;;) {
    const alert = await Alert.findOneAndUpdate(
      {
        level: "red",
        notifiedAt: { $gt: new Date(now.getTime() - RING_FOR_MS) },
        startsAt: { $lte: now },
        endsAt: { $gt: now },
        $or: [{ rangAt: null }, { rangAt: { $lte: due } }],
      },
      { $set: { rangAt: now } },
      { returnDocument: "after" }
    ).lean<AlertPush & { acks: { userId: string }[] }>();
    if (!alert) return count;
    off ??= await alarmOffUsers();
    await pushToDevices(alertPush(alert), undefined, undefined, {
      exclude: [...alert.acks.map((k) => k.userId), ...off],
      ttl: Math.ceil(RING_EVERY_MS / 1000),
    });
    count++;
  }
}

/** Энэ хүний хүлээн аваагүй улаан мэдээлэл — түгжээтэй аппад ч дохио өгөхөд (гарчиг нь мэдэгдэлд мөн харагддаг) */
export async function pendingRedAlert(userId: string, now = new Date()) {
  const alert = await Alert.findOne({ ...visibleNow(now), level: "red", "acks.userId": { $ne: userId } })
    .sort({ startsAt: -1 })
    .select("title")
    .lean<{ _id: unknown; title: string }>();
  if (!alert || (await Personnel.exists({ userId, noAlarm: true }))) return null;
  return { id: String(alert._id), title: alert.title };
}

/** Сервер асахад нэг удаа дуудна (instrumentation.ts) */
export function startAlertScheduler() {
  const g = globalThis as { __alertScheduler?: ReturnType<typeof setInterval> };
  if (g.__alertScheduler) return;
  const tick = async () => {
    await sendDueAlerts().catch((err) => console.error("[alerts] товлосон мэдээллийг илгээж чадсангүй:", err));
    await ringRedAlerts().catch((err) => console.error("[alerts] улаан дохиог давтаж чадсангүй:", err));
  };
  g.__alertScheduler = setInterval(tick, CHECK_MS);
  setTimeout(tick, Math.min(CHECK_MS, 10_000));
}
