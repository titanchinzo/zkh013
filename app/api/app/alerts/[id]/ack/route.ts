import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { getApprovedDevice } from "@/lib/device";
import Alert from "@/lib/models/Alert";

// "Хүлээн авлаа" — хүний нөөц хэн мэдээллийг авсныг харна
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const device = await getApprovedDevice();
  if (!device) return NextResponse.json({ error: "Энэ утсыг хүний нөөц зөвшөөрөөгүй байна" }, { status: 403 });
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });

  const updated = await Alert.updateOne(
    { _id: id, "acks.userId": { $ne: device.userId } },
    { $push: { acks: { userId: device.userId, at: new Date() } } }
  );
  if (!updated.matchedCount && !(await Alert.exists({ _id: id }))) {
    return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
