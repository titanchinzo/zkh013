import { NextRequest, NextResponse, after } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import DayRecord, { dutyIds } from "@/lib/models/DayRecord";
import Personnel from "@/lib/models/Personnel";
import { getCurrentRole } from "@/lib/auth-role";
import { isHrRole } from "@/lib/roles";
import {
  ATTENDANCE_STATUSES,
  DUTY_LABEL,
  WEEK_DAYS,
  addDays,
  formatDay,
  isDateKey,
  relativeDay,
  todayUb,
  weekStart,
  type AttendanceStatus,
} from "@/lib/hr";
import { pushToDevices } from "@/lib/push";
import { listGroups } from "@/lib/personnel-groups";

type DayDoc = { date: string; guard?: unknown[]; watch?: unknown[]; reminded?: unknown[]; attendance?: { personnel: unknown; status: string }[] };

/**
 * Сонгосон өдрийн ирц + тэр өдрийг агуулсан 7 хоногийн (Даваа–Ням) харуул хоногийн манааны хуваарь
 * + алба хаагчдын жагсаалт
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  if (!isHrRole(await getCurrentRole())) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  const { date } = await params;
  if (!isDateKey(date)) return NextResponse.json({ error: "Огноо буруу" }, { status: 400 });

  await connectToDatabase();
  const start = weekStart(date);
  const days = Array.from({ length: WEEK_DAYS }, (_, i) => addDays(start, i));
  const [records, personnel, groups] = await Promise.all([
    DayRecord.find({ date: { $in: [...new Set([...days, date])] } }).lean<DayDoc[]>(),
    Personnel.find().sort({ name: 1 }).select("rank name position group active userId").lean(),
    listGroups(),
  ]);
  const byDate = new Map(records.map((r) => [r.date, r]));

  return NextResponse.json({
    date,
    weekStart: start,
    attendance: Object.fromEntries((byDate.get(date)?.attendance ?? []).map((a) => [String(a.personnel), a.status])),
    week: days.map((d) => ({
      date: d,
      duty: dutyIds(byDate.get(d)),
      reminded: (byDate.get(d)?.reminded ?? []).map(String),
    })),
    personnel,
    groups: groups.map((g) => g.name),
  });
}

/**
 * Хадгална. body: { attendance?: { [id]: status | "" }, duty?: { [date]: id[] } }
 * attendance — сонгосон өдрийн ирц; duty — тэр 7 хоногийн өдөр бүрийн харуул хоногийн манаа.
 * Шинээр томилогдсон, утсаа бүртгүүлсэн хүмүүст мэдэгдэл очно.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  if (!isHrRole(await getCurrentRole())) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  const { date } = await params;
  if (!isDateKey(date)) return NextResponse.json({ error: "Огноо буруу" }, { status: 400 });
  const body = await req.json().catch(() => null);

  let attendance: { personnel: string; status: AttendanceStatus }[] | null = null;
  if (body?.attendance && typeof body.attendance === "object") {
    attendance = Object.entries(body.attendance as Record<string, unknown>)
      .filter(([, status]) => status !== "" && status != null)
      .map(([personnel, status]) => ({ personnel, status: status as AttendanceStatus }));
    if (attendance.some((a) => !ATTENDANCE_STATUSES.includes(a.status))) {
      return NextResponse.json({ error: "Ирцийн төлөв буруу" }, { status: 400 });
    }
  }

  const start = weekStart(date);
  const weekDays = Array.from({ length: WEEK_DAYS }, (_, i) => addDays(start, i));
  const duty = new Map<string, string[]>();
  if (body?.duty && typeof body.duty === "object") {
    for (const [day, ids] of Object.entries(body.duty as Record<string, unknown>)) {
      if (!weekDays.includes(day) || !Array.isArray(ids)) {
        return NextResponse.json({ error: "Хуваарь буруу" }, { status: 400 });
      }
      duty.set(day, [...new Set(ids.map(String))]);
    }
  }

  const ids = [...new Set([...[...duty.values()].flat(), ...(attendance ?? []).map((a) => a.personnel)])];
  if (!ids.every(isValidObjectId)) return NextResponse.json({ error: "Алба хаагч олдсонгүй" }, { status: 400 });
  await connectToDatabase();
  const people = await Personnel.find({ _id: { $in: ids } }).select("userId").lean<{ _id: unknown; userId?: string }[]>();
  if (people.length !== ids.length) return NextResponse.json({ error: "Алба хаагч олдсонгүй" }, { status: 400 });

  const previous = await DayRecord.find({ date: { $in: [...duty.keys()] } }).select("date guard watch").lean<DayDoc[]>();
  const before = new Map(previous.map((r) => [r.date, dutyIds(r)]));
  await Promise.all([
    ...(attendance ? [DayRecord.updateOne({ date }, { $set: { attendance } }, { upsert: true, runValidators: true })] : []),
    // Хуучин «хоногийн манаа» (watch) жагсаалтыг guard руу нийлүүлж хоосолно
    ...[...duty].map(([day, list]) => DayRecord.updateOne({ date: day }, { $set: { guard: list, watch: [] } }, { upsert: true })),
  ]);

  // Өнөөдрөөс хойших өдөрт шинээр томилогдсон хүмүүст нэг мэдэгдлээр хэлнэ (хариуг хүлээлгэхгүй)
  const today = todayUb();
  const userOf = new Map(people.map((p) => [String(p._id), p.userId]));
  const newDays = new Map<string, string[]>();
  for (const [day, list] of duty) {
    if (day < today) continue;
    for (const id of list.filter((id) => !(before.get(day) ?? []).includes(id))) {
      const userId = userOf.get(id);
      if (userId) newDays.set(userId, [...(newDays.get(userId) ?? []), day]);
    }
  }
  after(async () => {
    for (const [userId, days] of newDays) {
      const when = days.sort().map((d) => `${formatDay(d)} (${relativeDay(d, today)})`).join("; ");
      await pushToDevices({ title: DUTY_LABEL, body: `Таныг томиллоо: ${when}`, tag: `duty-assigned-${days[0]}` }, [userId]);
    }
  });

  return NextResponse.json({ ok: true });
}
