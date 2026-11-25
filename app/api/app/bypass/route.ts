import { NextRequest, NextResponse } from "next/server";
import { getApprovedDevice } from "@/lib/device";
import Device from "@/lib/models/Device";
import { getBypassNumbers } from "@/lib/settings";

/**
 * iPhone хэрэглэгч Emergency Bypass тохируулснаа тэмдэглэнэ (эсвэл болиулна). body: { done: boolean }
 * Ямар дугааруудыг хадгалсныг хамт санана: дараа нь шинэ дугаар нэмэгдвэл дахин тохируулахыг сануулна.
 */
export async function PUT(req: NextRequest) {
  const device = await getApprovedDevice();
  if (!device) return NextResponse.json({ error: "Энэ утсыг хүний нөөц зөвшөөрөөгүй байна" }, { status: 403 });
  const done = (await req.json().catch(() => null))?.done;
  if (typeof done !== "boolean") return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });

  if (!done) {
    await Device.updateOne({ _id: device._id }, { $unset: { bypass: 1 } });
    return NextResponse.json({ ok: true });
  }
  const numbers = await getBypassNumbers();
  if (numbers.length === 0) return NextResponse.json({ error: "Хүний нөөц дугаараа оруулаагүй байна" }, { status: 400 });
  // Дахин тэмдэглэвэл (шинэ дугаар) хүний нөөц дахин залгаж шалгана
  await Device.updateOne({ _id: device._id }, { $set: { bypass: { numbers, at: new Date() } } });
  return NextResponse.json({ ok: true });
}
