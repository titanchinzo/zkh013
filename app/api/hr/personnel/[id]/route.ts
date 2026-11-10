import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import Personnel from "@/lib/models/Personnel";
import { getCurrentRole } from "@/lib/auth-role";
import { isHrRole } from "@/lib/roles";
import { parsePersonnel } from "@/lib/hr";
import { deleteFile } from "@/lib/storage";

/**
 * Алба хаагчийн мэдээллийг засах (үг үсгийн алдаа г.м). body: { rank?, name?, position?, phone?, active?,
 * canRegister?, photo: null } — халагдсан хүнийг устгахгүй, идэвхгүй болгоно; photo: null — зургийг нь арилгана;
 * canRegister — «Бүртгэх эрх» (доод хүмүүсээ урьж бүртгэх).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isHrRole(await getCurrentRole())) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });

  await connectToDatabase();
  const person = await Personnel.findById(id);
  if (!person) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const parsed = parsePersonnel(body, true, person.rank);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const oldPhoto = body?.photo === null ? person.photo : "";
  person.set({
    ...parsed.value,
    ...(typeof body?.active === "boolean" ? { active: body.active } : {}),
    ...(typeof body?.canRegister === "boolean" ? { canRegister: body.canRegister } : {}),
    ...(body?.photo === null ? { photo: "" } : {}),
  });
  await person.save();
  if (oldPhoto) await deleteFile(oldPhoto).catch(() => {});
  return NextResponse.json({ person });
}
