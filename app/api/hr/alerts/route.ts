import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Alert from "@/lib/models/Alert";
import Device from "@/lib/models/Device";
import Personnel from "@/lib/models/Personnel";
import { getActor } from "@/lib/actor";
import { isHrRole } from "@/lib/roles";
import { DEFAULT_ALERT_LEVEL, alertLevel, parseAlert, personnelLabel } from "@/lib/hr";
import { announceAlert, notExpired } from "@/lib/alerts";
import { phoneKind } from "@/lib/bypass";

type AlertDoc = {
  _id: unknown;
  title: string;
  body: string;
  level?: string;
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
  // Сайтаас эсвэл утсан дээрх аппаас (зөвшөөрөгдсөн утас) — хүний нөөц, админ
  if (!isHrRole((await getActor())?.role ?? null)) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  await connectToDatabase();

  const [alerts, devices] = await Promise.all([
    Alert.find(notExpired()).sort({ startsAt: -1, createdAt: -1 }).limit(50).lean<AlertDoc[]>(),
    Device.find({ status: "approved" })
      .select("userId name rank phone label")
      .lean<{ userId: string; name: string; rank: string; phone?: string; label: string }[]>(),
  ]);
  const people = await Personnel.find({ userId: { $in: devices.map((d) => d.userId) } })
    .select("rank name userId phone")
    .lean<{ rank: string; name: string; userId: string; phone?: string }[]>();
  const nameOf = new Map(devices.map((d) => [d.userId, personnelLabel(d)]));
  for (const p of people) nameOf.set(p.userId, personnelLabel(p));
  const phoneOf = new Map(people.map((p) => [p.userId, p.phone]));

  return NextResponse.json({
    recipients: devices.length,
    alerts: alerts.map((a) => {
      const acked = new Set(a.acks.map((k) => k.userId));
      return {
        id: String(a._id),
        title: a.title,
        body: a.body,
        level: alertLevel(a.level),
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
        // Улаан мэдээлэлд хариу өгөөгүй хүн рүү залгах жагсаалт — iPhone нь эхэнд (дохио нь дуугүй үед дуугардаггүй)
        toCall:
          alertLevel(a.level) === "red"
            ? devices
                .filter((d) => !acked.has(d.userId))
                .map((d) => ({
                  id: d.userId,
                  name: nameOf.get(d.userId) ?? d.name,
                  phone: phoneOf.get(d.userId) || d.phone || "",
                  iphone: phoneKind(d.label) === "iphone",
                }))
                .sort((x, y) => Number(y.iphone) - Number(x.iphone))
            : [],
      };
    }),
  });
}

/**
 * Зарлан мэдээлэл илгээнэ. body: { title, body, startsAt?, endsAt, level? } — эхлэх цаг болоход (хоосон бол одоо)
 * зөвшөөрөгдсөн бүх утас руу мэдэгдэл очиж, дуусах цаг өнгөрмөгц автоматаар устна. level: red | yellow | green.
 */
export async function POST(req: NextRequest) {
  const actor = await getActor();
  if (!actor || !isHrRole(actor.role)) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  const parsed = parseAlert(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  await connectToDatabase();
  // Утаснаас илгээсэн бол хүний нөөцийн бүртгэлийн нэр (цолтой), сайтаас бол Clerk-ийн нэр
  const alert = await Alert.create({ level: DEFAULT_ALERT_LEVEL, ...parsed.value, createdBy: actor.userId, createdByName: actor.name });
  const result = await announceAlert(alert._id);
  return NextResponse.json({ id: String(alert._id), ...(result ?? { scheduled: true }) }, { status: 201 });
}
