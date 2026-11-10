import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import Alert from "@/lib/models/Alert";
import Device from "@/lib/models/Device";
import Personnel from "@/lib/models/Personnel";
import { getCurrentRole } from "@/lib/auth-role";
import { isHrRole } from "@/lib/roles";
import { ALERT_LIMITS, personnelLabel } from "@/lib/hr";
import { pushToDevices } from "@/lib/push";

/** Илгээсэн зарлан мэдээллүүд, хэн "Хүлээн авлаа" дарсан, хэн дараагүй */
export async function GET() {
  if (!isHrRole(await getCurrentRole())) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  await connectToDatabase();

  const [alerts, devices] = await Promise.all([
    Alert.find().sort({ createdAt: -1 }).limit(30).lean<
      { _id: unknown; title: string; body: string; createdByName: string; createdAt: Date; acks: { userId: string; at: Date }[] }[]
    >(),
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
        acks: a.acks.map((k) => ({ name: nameOf.get(k.userId) ?? "Хасагдсан утас", at: k.at })),
        // Одоо зөвшөөрөгдсөн утастай боловч хариу өгөөгүй хүмүүс
        waiting: devices.filter((d) => !acked.has(d.userId)).map((d) => nameOf.get(d.userId) ?? d.name),
      };
    }),
  });
}

/** Зарлан мэдээлэл илгээнэ. body: { title, body } — зөвшөөрөгдсөн бүх утас руу мэдэгдэл очно */
export async function POST(req: NextRequest) {
  if (!isHrRole(await getCurrentRole())) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  const data = await req.json().catch(() => null);
  const title = typeof data?.title === "string" ? data.title.trim() : "";
  const body = typeof data?.body === "string" ? data.body.trim() : "";
  if (!title) return NextResponse.json({ error: "Гарчгийг бичнэ үү" }, { status: 400 });
  if (title.length > ALERT_LIMITS.title || body.length > ALERT_LIMITS.body) {
    return NextResponse.json({ error: "Хэт урт байна" }, { status: 400 });
  }

  const user = await currentUser();
  await connectToDatabase();
  const alert = await Alert.create({
    title,
    body,
    createdBy: user?.id ?? "",
    createdByName: user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "",
  });
  const result = await pushToDevices({ title, body, tag: `alert-${alert._id}` });
  return NextResponse.json({ id: String(alert._id), ...result }, { status: 201 });
}
