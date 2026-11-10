import { NextRequest, NextResponse, after } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import DayRecord from "@/lib/models/DayRecord";
import Personnel from "@/lib/models/Personnel";
import { getCurrentRole } from "@/lib/auth-role";
import { isHrRole } from "@/lib/roles";
import { ATTENDANCE_STATUSES, GUARD_DAYS, addDays, formatDay, isDateKey, type AttendanceStatus } from "@/lib/hr";
import { pushToDevices } from "@/lib/push";

type Ids = { guard: unknown[]; watch: unknown[] };
const idsOf = (list: unknown[] | undefined) => (list ?? []).map(String);

/** Өдрийн ирц, харуул, манаа + тэр өдрөөс эхлэх 7 хоногийн хуваарь + алба хаагчдын жагсаалт */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  if (!isHrRole(await getCurrentRole())) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  const { date } = await params;
  if (!isDateKey(date)) return NextResponse.json({ error: "Огноо буруу" }, { status: 400 });

  await connectToDatabase();
  const last = addDays(date, GUARD_DAYS - 1);
  const [records, personnel] = await Promise.all([
    DayRecord.find({ date: { $gte: date, $lte: last } }).lean<(Ids & { date: string; attendance?: { personnel: unknown; status: string }[] })[]>(),
    Personnel.find().sort({ name: 1 }).select("rank name position active userId").lean(),
  ]);
  const byDate = new Map(records.map((r) => [r.date, r]));
  const day = byDate.get(date);

  return NextResponse.json({
    date,
    guard: idsOf(day?.guard),
    watch: idsOf(day?.watch),
    attendance: Object.fromEntries((day?.attendance ?? []).map((a) => [String(a.personnel), a.status])),
    week: Array.from({ length: GUARD_DAYS }, (_, i) => {
      const d = addDays(date, i);
      const r = byDate.get(d);
      return { date: d, guard: idsOf(r?.guard), watch: idsOf(r?.watch) };
    }),
    personnel,
  });
}

/**
 * Өдрийг хадгална. body: { guard: id[], watch: id[], attendance: { [id]: status }, guardWeek?: boolean }
 * guardWeek — харуулыг энэ өдрөөс эхлэн 7 хоногт (дараагийн 6 өдөрт ч) оноох.
 * Шинээр томилогдсон хүмүүсийн утас руу мэдэгдэл очно.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  if (!isHrRole(await getCurrentRole())) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  const { date } = await params;
  if (!isDateKey(date)) return NextResponse.json({ error: "Огноо буруу" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const guard = [...new Set(Array.isArray(body?.guard) ? body.guard.map(String) : [])] as string[];
  const watch = [...new Set(Array.isArray(body?.watch) ? body.watch.map(String) : [])] as string[];
  const rawAttendance = body?.attendance && typeof body.attendance === "object" ? body.attendance : {};
  const attendance = Object.entries(rawAttendance as Record<string, unknown>)
    .filter(([, status]) => status !== "" && status != null)
    .map(([personnel, status]) => ({ personnel, status: status as AttendanceStatus }));
  if (attendance.some((a) => !ATTENDANCE_STATUSES.includes(a.status))) {
    return NextResponse.json({ error: "Ирцийн төлөв буруу" }, { status: 400 });
  }

  const ids = [...new Set([...guard, ...watch, ...attendance.map((a) => a.personnel)])];
  if (!ids.every(isValidObjectId)) return NextResponse.json({ error: "Алба хаагч олдсонгүй" }, { status: 400 });
  await connectToDatabase();
  const people = await Personnel.find({ _id: { $in: ids } }).select("userId").lean<{ _id: unknown; userId?: string }[]>();
  if (people.length !== ids.length) return NextResponse.json({ error: "Алба хаагч олдсонгүй" }, { status: 400 });

  const guardWeek = body?.guardWeek === true;
  const previous = await DayRecord.findOne({ date }).select("guard watch").lean<Ids>();
  await DayRecord.updateOne({ date }, { $set: { guard, watch, attendance } }, { upsert: true, runValidators: true });
  if (guardWeek) {
    await Promise.all(
      Array.from({ length: GUARD_DAYS - 1 }, (_, i) =>
        DayRecord.updateOne({ date: addDays(date, i + 1) }, { $set: { guard } }, { upsert: true })
      )
    );
  }

  // Шинээр томилогдсон, утсаа бүртгүүлсэн хүмүүст мэдэгдэнэ (хариуг хүлээлгэхгүй)
  const userOf = new Map(people.map((p) => [String(p._id), p.userId]));
  const newly = (now: string[], before: unknown[] | undefined) =>
    now.filter((id) => !idsOf(before).includes(id)).map((id) => userOf.get(id)).filter((u): u is string => Boolean(u));
  const newGuards = newly(guard, previous?.guard);
  const newWatch = newly(watch, previous?.watch);
  after(async () => {
    if (newGuards.length) {
      const until = guardWeek ? ` – ${formatDay(addDays(date, GUARD_DAYS - 1))}` : "";
      await pushToDevices({ title: "Харуулд томилогдлоо", body: `${formatDay(date)}${until}`, tag: `guard-${date}` }, newGuards);
    }
    if (newWatch.length) {
      await pushToDevices({ title: "Хоногийн манаанд томилогдлоо", body: formatDay(date), tag: `watch-${date}` }, newWatch);
    }
  });

  return NextResponse.json({ ok: true });
}
