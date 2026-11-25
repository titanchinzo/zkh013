import { NextResponse } from "next/server";
import { getApprovedDevice } from "@/lib/device";
import Alert from "@/lib/models/Alert";
import { visibleNow } from "@/lib/alerts";
import { userRole } from "@/lib/actor";
import News from "@/lib/models/News";
import { canReview, isHrRole } from "@/lib/roles";
import Device from "@/lib/models/Device";

async function newsBadge(userId: string) {
  const { role } = await userRole(userId);
  const [pending, latest] = await Promise.all([
    canReview(role) ? News.countDocuments({ status: "pending" }) : 0,
    News.findOne({ status: "published" }).sort({ createdAt: -1 }).select("createdAt").lean<{ createdAt: Date }>(),
  ]);
  return { role, pending, latestAt: latest?.createdAt ?? null };
}
import DayRecord, { dutyIds } from "@/lib/models/DayRecord";
import Personnel from "@/lib/models/Personnel";
import { bypassState } from "@/lib/bypass";
import { WEEK_DAYS, addDays, alertLevel, personnelLabel, todayUb, weekStart } from "@/lib/hr";
import { getBypassNumbers } from "@/lib/settings";

type DayDoc = { date: string; guard?: unknown[]; watch?: unknown[] };

// Утсан дээрх «Зарлан мэдээлэх»: сүүлийн зарлан мэдээллүүд, энэ болон дараагийн 7 хоногийн харуул хоногийн
// манааны хуваарь, тухайн хүний дараагийн манаа
export async function GET() {
  const device = await getApprovedDevice();
  if (!device) return NextResponse.json({ error: "Энэ утсыг хүний нөөц зөвшөөрөөгүй байна" }, { status: 403 });

  const news = await newsBadge(device.userId);
  const today = todayUb();
  const start = weekStart(today);
  const days = Array.from({ length: WEEK_DAYS * 2 }, (_, i) => addDays(start, i));
  const [alerts, person, records, bypassNumbers] = await Promise.all([
    // Эхэлсэн, хугацаа нь дуусаагүй мэдээлэл — товлосон нь эхлэх цагтаа, дууссан нь тэр дороо алга болно
    Alert.find(visibleNow()).sort({ startsAt: -1, createdAt: -1 }).limit(20).lean<
      {
        _id: unknown;
        title: string;
        body: string;
        level?: string;
        createdAt: Date;
        startsAt?: Date;
        endsAt?: Date;
        editedAt?: Date;
        acks: { userId: string }[];
      }[]
    >(),
    Personnel.findOne({ userId: device.userId, active: true })
      .select("rank name position phone photo canRegister")
      .lean<{ _id: unknown; rank: string; name: string; position: string; phone?: string; photo?: string; canRegister?: boolean }>(),
    DayRecord.find({ date: { $in: days } }).select("date guard watch").lean<DayDoc[]>(),
    getBypassNumbers(),
  ]);
  const pid = person ? String(person._id) : "";

  // Хуваарьт орсон хүмүүсийн нэр
  const byDate = new Map(records.map((r) => [r.date, dutyIds(r)]));
  const people = await Personnel.find({ _id: { $in: [...new Set([...byDate.values()].flat())] } })
    .select("rank name")
    .lean<{ _id: unknown; rank: string; name: string }[]>();
  const nameOf = new Map(people.map((p) => [String(p._id), personnelLabel(p)]));

  // Дараагийн манаа — 2 долоо хоногоос хол байж болно
  const next = person
    ? await DayRecord.findOne({ date: { $gte: today }, $or: [{ guard: person._id }, { watch: person._id }] })
        .sort({ date: 1 })
        .select("date")
        .lean<{ date: string }>()
    : null;

  return NextResponse.json({
    person: person
      ? {
          rank: person.rank,
          name: person.name,
          position: person.position,
          phone: person.phone ?? "",
          photo: person.photo ?? "",
          canRegister: Boolean(person.canRegister),
        }
      : null,
    pushEnabled: Boolean(device.push?.endpoint),
    // iPhone: яаралтай дуудлагыг дуугүй үед ч дуугардаг болгох заавар (аппад зөвхөн iPhone дээр харагдана)
    bypass: bypassNumbers.length
      ? { numbers: bypassNumbers, state: bypassState(device.bypass, bypassNumbers), at: device.bypass?.at ?? null }
      : null,
    // «Мэдээ» хэсгийн тэмдэг: хянагчид хяналт хүлээж буй мэдээний тоо, бусдад шинэ мэдээ нэмэгдсэн эсэх
    news,
    // Шийдвэр хүлээж буй утасны хүсэлтийн тоо — зөвхөн хүний нөөц, админд (бусдад байхгүй)
    ...(isHrRole(news.role) ? { requests: await Device.countDocuments({ status: "pending" }) } : {}),
    nextDuty: next?.date ?? null,
    alerts: alerts.map((a) => ({
      id: String(a._id),
      title: a.title,
      body: a.body,
      level: alertLevel(a.level),
      createdAt: a.createdAt,
      startsAt: a.startsAt ?? a.createdAt,
      endsAt: a.endsAt ?? null,
      edited: Boolean(a.editedAt),
      acked: a.acks.some((k) => k.userId === device.userId),
    })),
    weeks: [start, addDays(start, WEEK_DAYS)].map((weekFrom) => ({
      start: weekFrom,
      days: Array.from({ length: WEEK_DAYS }, (_, i) => {
        const date = addDays(weekFrom, i);
        const ids = byDate.get(date) ?? [];
        return { date, people: ids.map((id) => ({ name: nameOf.get(id) ?? "—", me: id === pid })) };
      }),
    })),
  });
}
