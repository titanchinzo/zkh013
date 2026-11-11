import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import Alert from "@/lib/models/Alert";
import { getCurrentRole } from "@/lib/auth-role";
import { isHrRole } from "@/lib/roles";
import { parseAlert } from "@/lib/hr";
import { announceAlert } from "@/lib/alerts";

type Params = { params: Promise<{ id: string }> };

/**
 * Зарлан мэдээллийг засна. body: { title, body, startsAt?, endsAt, renotify? } — renotify: true бол утсанд дахин
 * мэдэгдэнэ (эхлэх цаг нь болсон бол одоо, үгүй бол тэр цагт), «Хүлээн авлаа» тэмдэглэл шинээр эхэлнэ.
 * Мэдэгдэл нь хараахан очоогүй (товлосон) мэдээлэл эхлэх цагтаа очно.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  if (!isHrRole(await getCurrentRole())) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });

  const data = await req.json().catch(() => null);
  const parsed = parseAlert(data);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  await connectToDatabase();
  const alert = await Alert.findById(id);
  if (!alert) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });

  // Хугацаагүй хуучин мэдээлэл үүсгэхдээ шууд илгээгдсэн — засахад дахин очихгүй
  if (!alert.startsAt && !alert.notifiedAt) alert.notifiedAt = alert.createdAt;
  alert.set({ ...parsed.value, editedAt: new Date() });
  if (data?.renotify === true && alert.notifiedAt) {
    alert.notifiedAt = undefined;
    alert.set("acks", []);
  }
  await alert.save();

  const result = await announceAlert(alert._id);
  return NextResponse.json({ ok: true, ...(result ?? {}) });
}

/** Зарлан мэдээллийг устгана — утсан дээрээс ч арилна */
export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!isHrRole(await getCurrentRole())) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });

  await connectToDatabase();
  const { deletedCount } = await Alert.deleteOne({ _id: id });
  if (!deletedCount) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
