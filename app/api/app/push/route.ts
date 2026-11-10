import { NextRequest, NextResponse } from "next/server";
import { getApprovedDevice } from "@/lib/device";
import { vapidPublicKey } from "@/lib/push";

const NOT_APPROVED = { error: "Энэ утсыг хүний нөөц зөвшөөрөөгүй байна" };

/** Мэдэгдэл захиалахад хэрэгтэй нийтийн түлхүүр */
export async function GET() {
  return NextResponse.json({ publicKey: vapidPublicKey() });
}

/** Энэ утасны мэдэгдлийн захиалгыг хадгална. body: PushSubscription-ий JSON */
export async function POST(req: NextRequest) {
  const device = await getApprovedDevice();
  if (!device) return NextResponse.json(NOT_APPROVED, { status: 403 });
  const sub = await req.json().catch(() => null);
  const endpoint = typeof sub?.endpoint === "string" ? sub.endpoint : "";
  const valid =
    endpoint.startsWith("https://") &&
    endpoint.length < 1000 &&
    typeof sub?.keys?.p256dh === "string" &&
    typeof sub?.keys?.auth === "string";
  if (!valid) return NextResponse.json({ error: "Мэдэгдлийн захиалга буруу" }, { status: 400 });

  device.push = { endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } };
  await device.save();
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const device = await getApprovedDevice();
  if (!device) return NextResponse.json(NOT_APPROVED, { status: 403 });
  device.push = undefined;
  await device.save();
  return NextResponse.json({ ok: true });
}
