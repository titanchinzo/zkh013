import { NextResponse } from "next/server";
import { getApprovedDevice } from "@/lib/device";
import Alert from "@/lib/models/Alert";
import DayRecord from "@/lib/models/DayRecord";
import Personnel from "@/lib/models/Personnel";
import { addDays, todayUb } from "@/lib/hr";

// Утсан дээрх "Зарлан мэдээлэх": сүүлийн зарлан мэдээллүүд, тухайн хүний ойрын харуул, манаа
export async function GET() {
  const device = await getApprovedDevice();
  if (!device) return NextResponse.json({ error: "Энэ утсыг хүний нөөц зөвшөөрөөгүй байна" }, { status: 403 });

  const today = todayUb();
  const [alerts, person] = await Promise.all([
    Alert.find().sort({ createdAt: -1 }).limit(20).lean<
      { _id: unknown; title: string; body: string; createdAt: Date; acks: { userId: string }[] }[]
    >(),
    Personnel.findOne({ userId: device.userId, active: true }).select("rank name position").lean<{ _id: unknown; rank: string; name: string; position: string }>(),
  ]);
  const duties = person
    ? await DayRecord.find({
        date: { $gte: today, $lte: addDays(today, 30) },
        $or: [{ guard: person._id }, { watch: person._id }],
      })
        .sort({ date: 1 })
        .select("date guard watch")
        .lean<{ date: string; guard: unknown[]; watch: unknown[] }[]>()
    : [];
  const pid = person ? String(person._id) : "";

  return NextResponse.json({
    person: person ? { rank: person.rank, name: person.name, position: person.position } : null,
    pushEnabled: Boolean(device.push?.endpoint),
    alerts: alerts.map((a) => ({
      id: String(a._id),
      title: a.title,
      body: a.body,
      createdAt: a.createdAt,
      acked: a.acks.some((k) => k.userId === device.userId),
    })),
    duties: duties.map((d) => ({
      date: d.date,
      guard: d.guard.map(String).includes(pid),
      watch: d.watch.map(String).includes(pid),
    })),
  });
}
