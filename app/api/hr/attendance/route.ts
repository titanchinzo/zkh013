import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import DayRecord, { dutyIds } from "@/lib/models/DayRecord";
import Personnel from "@/lib/models/Personnel";
import { getCurrentRole } from "@/lib/auth-role";
import { isHrRole } from "@/lib/roles";
import { isMonthKey, monthDays, todayUb } from "@/lib/hr";
import { listGroups } from "@/lib/personnel-groups";

type DayDoc = { date: string; guard?: unknown[]; watch?: unknown[]; attendance?: { personnel: unknown; status: string }[] };

/**
 * Ирцийн хуанли: ?month=YYYY-MM (хоосон бол энэ сар) — тэр сарын өдөр бүрийн ирц, манаанд гарсан хүмүүс,
 * алба хаагчдын жагсаалт. Ирцийг /api/hr/days/[date]-аар өдрөөр нь хадгална.
 */
export async function GET(req: NextRequest) {
  if (!isHrRole(await getCurrentRole())) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  const month = req.nextUrl.searchParams.get("month") || todayUb().slice(0, 7);
  if (!isMonthKey(month)) return NextResponse.json({ error: "Сар буруу" }, { status: 400 });

  const days = monthDays(month);
  await connectToDatabase();
  const [records, personnel, groups] = await Promise.all([
    DayRecord.find({ date: { $gte: days[0], $lte: days[days.length - 1] } })
      .select("date attendance guard watch")
      .lean<DayDoc[]>(),
    Personnel.find().sort({ name: 1 }).select("rank name position group active createdAt").lean(),
    listGroups(),
  ]);

  return NextResponse.json({
    month,
    days: records
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({
        date: r.date,
        attendance: Object.fromEntries((r.attendance ?? []).map((a) => [String(a.personnel), a.status])),
        duty: dutyIds(r),
      })),
    personnel,
    groups: groups.map((g) => g.name),
  });
}
