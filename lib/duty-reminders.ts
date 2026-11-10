import "server-only";
import { connectToDatabase } from "@/lib/mongodb";
import DayRecord, { dutyIds } from "@/lib/models/DayRecord";
import Personnel from "@/lib/models/Personnel";
import { DUTY_LABEL, DUTY_REMINDER_HOUR, DUTY_REMINDER_TEXT, hourUb, todayUb } from "@/lib/hr";
import { pushToDevices } from "@/lib/push";

// Шалгах давтамж — DUTY_REMINDER_CHECK_MS-ээр өөрчилж болно (туршилтад)
const CHECK_MS = Number(process.env.DUTY_REMINDER_CHECK_MS) || 5 * 60 * 1000;

/**
 * Өнөөдөр харуул хоногийн манаанд гарах хүмүүст 11 цагаас хойш нэг удаа «Тайван хоноорой» мэдэгдэл илгээнэ.
 * 11 цагийн дараа томилогдсон эсвэл сервер унтарч байсан бол дараагийн шалгалтаар (тэр өдөртөө) очно.
 */
export async function sendDutyReminders(now = new Date()) {
  if (hourUb(now) < DUTY_REMINDER_HOUR) return 0;
  await connectToDatabase();
  const date = todayUb(now);
  const day = await DayRecord.findOne({ date }).select("guard watch reminded").lean<{
    guard?: unknown[];
    watch?: unknown[];
    reminded?: unknown[];
  }>();
  const reminded = new Set((day?.reminded ?? []).map(String));
  const due = dutyIds(day).filter((id) => !reminded.has(id));
  if (!due.length) return 0;

  // Эхлээд «очсон» гэж тэмдэглэнэ — дахин давтагдахгүй
  await DayRecord.updateOne({ date }, { $addToSet: { reminded: { $each: due } } });
  const people = await Personnel.find({ _id: { $in: due }, userId: { $type: "string" } })
    .select("userId")
    .lean<{ userId: string }[]>();
  if (!people.length) return 0;
  await pushToDevices(
    { title: DUTY_LABEL, body: DUTY_REMINDER_TEXT, tag: `duty-${date}` },
    people.map((p) => p.userId)
  );
  return people.length;
}

/** Сервер асахад нэг удаа дуудна (instrumentation.ts) */
export function startDutyReminders() {
  const g = globalThis as { __dutyReminders?: ReturnType<typeof setInterval> };
  if (g.__dutyReminders) return;
  const tick = () => sendDutyReminders().catch((err) => console.error("[duty] сануулга илгээж чадсангүй:", err));
  g.__dutyReminders = setInterval(tick, CHECK_MS);
  setTimeout(tick, Math.min(CHECK_MS, 30_000));
}
