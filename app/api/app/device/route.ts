import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import Device from "@/lib/models/Device";
import Personnel from "@/lib/models/Personnel";
import { deviceLabel, getCurrentDevice, newDeviceToken, setDeviceCookie } from "@/lib/device";
import { parsePersonnel } from "@/lib/hr";
import { trustOf } from "@/lib/invite";

type ClerkUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;
type Fields = { rank?: string; name?: string; position?: string; phone?: string };

/**
 * Урилгаар орж ирсэн (эсвэл админ нэмсэн) хүний АНХНЫ утас хүний нөөцийн зөвшөөрөлгүй шууд идэвхжинэ.
 * Утсаа солих, гээсэн бол дараагийн утсыг хүний нөөц зөвшөөрнө.
 */
async function directTrust(user: ClerkUser) {
  const trust = trustOf(user);
  if (!trust) return null;
  await connectToDatabase();
  return (await Device.exists({ userId: user.id })) ? null : trust;
}

/**
 * Урилгаар орж ирсэн хүний алба хаагчийн бүртгэлийг холбоно эсвэл шинээр үүсгэнэ. Хүний нөөц тэр хүнийг
 * урьдчилж бүртгэсэн бол (урилгад сонгосон, эсвэл ижил утасны дугаартай) тэр бүртгэлтэй нь холбогдож давхардахгүй.
 */
async function linkPersonnel(userId: string, fields: Fields, trust: { invitedBy: string; personnelId?: string }) {
  const invitedBy = trust.invitedBy === "role" ? undefined : trust.invitedBy;
  let person = await Personnel.findOne({ userId });
  if (!person && trust.personnelId && isValidObjectId(trust.personnelId)) {
    const target = await Personnel.findById(trust.personnelId);
    if (target && !target.userId) person = target;
  }
  if (!person && fields.phone) {
    // Ижил дугаартай холбогдоогүй бүртгэл нэгээс олон бол (дундын утас г.м) аль нь болохыг мэдэхгүй тул шинээр үүсгэнэ
    const samePhone = await Personnel.find({ phone: fields.phone, active: true, userId: null }).limit(2);
    if (samePhone.length === 1) person = samePhone[0];
  }
  if (!person) {
    await Personnel.create({ ...fields, userId, invitedBy });
    return;
  }
  // Хүний нөөцийн бичсэн мэдээллийг хэвээр үлдээж, дутууг нь бөглөнө
  person.set({
    userId,
    phone: fields.phone,
    rank: person.rank || fields.rank,
    name: person.name || fields.name,
    position: person.position || fields.position,
    invitedBy: person.invitedBy || invitedBy,
    active: true,
  });
  await person.save();
}

/** Энэ утасны төлөв: { signedIn, direct, device } — direct: урилгаар орж ирсэн тул бүртгэл шууд идэвхжинэ */
export async function GET() {
  const [user, current] = await Promise.all([currentUser(), getCurrentDevice()]);
  const d = current?.device;
  return NextResponse.json({
    signedIn: Boolean(user),
    direct: user && !d ? Boolean(await directTrust(user)) : false,
    device: d ? { status: d.status, rank: d.rank, name: d.name, position: d.position, label: d.label } : null,
  });
}

/**
 * Энэ утсыг бүртгүүлнэ. Нэвтэрсэн (и-мэйлээ баталгаажуулсан) хүн л илгээнэ. body: { rank, name, position, phone }
 * Урилгаар орж ирсэн хүний анхны утас шууд идэвхжинэ, бусад тохиолдолд хүний нөөц зөвшөөрнө.
 */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Эхлээд нэвтэрнэ үү" }, { status: 401 });
  const parsed = parsePersonnel(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const current = await getCurrentDevice();
  if (current && current.device.userId === user.id && ["pending", "approved"].includes(current.device.status)) {
    return NextResponse.json({ status: current.device.status });
  }

  await connectToDatabase();
  const direct = await directTrust(user);
  const { token, tokenHash } = newDeviceToken();
  const device = {
    ...parsed.value,
    userId: user.id,
    email: user.primaryEmailAddress?.emailAddress ?? "",
    label: deviceLabel(req.headers.get("user-agent")),
    tokenHash,
  };

  if (direct) {
    await linkPersonnel(user.id, parsed.value, direct);
    await Device.create({ ...device, status: "approved", decidedBy: direct.invitedBy, decidedAt: new Date() });
    await setDeviceCookie(token);
    return NextResponse.json({ status: "approved" }, { status: 201 });
  }

  // Нэг хүн нэг л хүлээгдэж буй хүсэлттэй байна — шинэ утаснаас дахин илгээвэл хуучныг нь орлоно
  await Device.deleteMany({ userId: user.id, status: "pending" });
  await Device.create(device);
  await setDeviceCookie(token);
  return NextResponse.json({ status: "pending" }, { status: 201 });
}
