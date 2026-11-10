import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import Device from "@/lib/models/Device";
import { deviceLabel, getCurrentDevice, newDeviceToken, setDeviceCookie } from "@/lib/device";
import { parsePersonnel } from "@/lib/hr";

/** Энэ утасны төлөв: { signedIn, device: { status, name, ... } | null } */
export async function GET() {
  const [{ userId }, current] = await Promise.all([auth(), getCurrentDevice()]);
  const d = current?.device;
  return NextResponse.json({
    signedIn: Boolean(userId),
    device: d ? { status: d.status, rank: d.rank, name: d.name, position: d.position, label: d.label } : null,
  });
}

/**
 * Энэ утсыг бүртгүүлэх хүсэлт — хүний нөөц зөвшөөрнө. Нэвтэрсэн (и-мэйлээ баталгаажуулсан) хүн л илгээнэ.
 * body: { rank, name, position }
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
  // Нэг хүн нэг л хүлээгдэж буй хүсэлттэй байна — шинэ утаснаас дахин илгээвэл хуучныг нь орлоно
  await Device.deleteMany({ userId: user.id, status: "pending" });
  const { token, tokenHash } = newDeviceToken();
  await Device.create({
    ...parsed.value,
    userId: user.id,
    email: user.primaryEmailAddress?.emailAddress ?? "",
    label: deviceLabel(req.headers.get("user-agent")),
    tokenHash,
  });
  await setDeviceCookie(token);
  return NextResponse.json({ status: "pending" }, { status: 201 });
}
