import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import Alert from "@/lib/models/Alert";
import Device from "@/lib/models/Device";
import Personnel from "@/lib/models/Personnel";
import { getCurrentRole } from "@/lib/auth-role";
import { isHrRole } from "@/lib/roles";
import { parseAlert, personnelLabel } from "@/lib/hr";
import { announceAlert, notExpired } from "@/lib/alerts";

type AlertDoc = {
  _id: unknown;
  title: string;
  body: string;
  createdByName: string;
  createdAt: Date;
  startsAt?: Date;
  endsAt?: Date;
  notifiedAt?: Date;
  editedAt?: Date;
  acks: { userId: string; at: Date }[];
};

/**
 * Хугацаа нь дуусаагүй зарлан мэдээллүүд (товлосон ч), хэн "Хүлээн авлаа" дарсан, хэн дараагүй.
 * Хугацаа нь дууссан мэдээлэл автоматаар устдаг тул энд харагдахгүй.
 */
export async function GET() {
  if (!isHrRole(await getCurrentRole())) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  await connectToDatabase();

  const [alerts, devices] = await Promise.all([
    Alert.find(notExpired()).sort({ startsAt: -1, createdAt: -1 }).limit(50).lean<AlertDoc[]>(),
    Device.find({ status: "approved" }).select("userId name rank").lean<{ userId: string; name: string; rank: string }[]>(),
  ]);
  const people = await Personnel.find({ userId: { $in: devices.map((d) => d.userId) } })
    .select("rank name userId")
    .lean<{ rank: string; name: string; userId: string }[]>();
  const nameOf = new Map(devices.map((d) => [d.userId, personnelLabel(d)]));
  for (const p of people) nameOf.set(p.userId, personnelLabel(p));

  return NextResponse.json({
    recipients: devices.length,
    alerts: alerts.map((a) => {
      const acked = new Set(a.acks.map((k) => k.userId));
      return {
        id: String(a._id),
        title: a.title,
        body: a.body,
        createdByName: a.createdByName,
        createdAt: a.createdAt,
        // Хуучин (хугацаагүй) мэдээлэл үүсгэхдээ шууд илгээгдсэн
        startsAt: a.startsAt ?? a.createdAt,
        endsAt: a.endsAt ?? null,
        notified: Boolean(a.notifiedAt) || !a.startsAt,
        editedAt: a.editedAt ?? null,
        acks: a.acks.map((k) => ({ name: nameOf.get(k.userId) ?? "Хасагдсан утас", at: k.at })),
        // Одоо зөвшөөрөгдсөн утастай боловч хариу өгөөгүй хүмүүс
        waiting: devices.filter((d) => !acked.has(d.userId)).map((d) => nameOf.get(d.userId) ?? d.name),
      };
    }),
  });
}

/**
 * Зарлан мэдээлэл илгээнэ. body: { title, body, startsAt?, endsAt } — эхлэх цаг болоход (хоосон бол одоо)
 * зөвшөөрөгдсөн бүх утас руу мэдэгдэл очиж, дуусах цаг өнгөрмөгц автоматаар устна.
 */
export async function POST(req: NextRequest) {
  if (!isHrRole(await getCurrentRole())) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  const parsed = parseAlert(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const user = await currentUser();
  await connectToDatabase();
  const alert = await Alert.create({
    ...parsed.value,
    createdBy: user?.id ?? "",
    createdByName: user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "",
  });
  const result = await announceAlert(alert._id);
  return NextResponse.json({ id: String(alert._id), ...(result ?? { scheduled: true }) }, { status: 201 });
}
