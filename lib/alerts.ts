import "server-only";
import { connectToDatabase } from "@/lib/mongodb";
import Alert from "@/lib/models/Alert";
import { pushToDevices } from "@/lib/push";

// Товлосон мэдээллийг шалгах давтамж — ALERT_CHECK_MS-ээр өөрчилж болно (туршилтад)
const CHECK_MS = Number(process.env.ALERT_CHECK_MS) || 30_000;

/** Дуусах цаг нь болоогүй (хуучин, хугацаагүй мэдээлэлд endsAt байхгүй) */
export const notExpired = (now = new Date()) => ({ $or: [{ endsAt: null }, { endsAt: { $gt: now } }] });

/** Утсанд харагдах мэдээлэл: эхэлсэн, дуусаагүй */
export const visibleNow = (now = new Date()) => ({
  $and: [{ $or: [{ startsAt: null }, { startsAt: { $lte: now } }] }, notExpired(now)],
});

/**
 * Эхлэх цаг нь болсон, мэдэгдэл нь хараахан очоогүй мэдээллийг эхлээд «очсон» гэж тэмдэглээд утсанд илгээнэ —
 * хоёр газраас зэрэг дуудсан ч давхар очихгүй. Хуучин мэдээлэлд startsAt байхгүй тул хамаарахгүй.
 */
async function announceOne(filter: Record<string, unknown>, now: Date) {
  const alert = await Alert.findOneAndUpdate(
    { ...filter, notifiedAt: null, startsAt: { $lte: now }, endsAt: { $gt: now } },
    { $set: { notifiedAt: now } },
    { returnDocument: "after" }
  ).lean<{ _id: unknown; title: string; body: string }>();
  if (!alert) return null;
  return pushToDevices({ title: alert.title, body: alert.body, tag: `alert-${alert._id}` });
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

/** Сервер асахад нэг удаа дуудна (instrumentation.ts) */
export function startAlertScheduler() {
  const g = globalThis as { __alertScheduler?: ReturnType<typeof setInterval> };
  if (g.__alertScheduler) return;
  const tick = () => sendDueAlerts().catch((err) => console.error("[alerts] товлосон мэдээллийг илгээж чадсангүй:", err));
  g.__alertScheduler = setInterval(tick, CHECK_MS);
  setTimeout(tick, Math.min(CHECK_MS, 10_000));
}
