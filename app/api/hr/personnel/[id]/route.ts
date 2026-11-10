import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import Personnel from "@/lib/models/Personnel";
import { getCurrentRole } from "@/lib/auth-role";
import { isHrRole } from "@/lib/roles";
import { parsePersonnel } from "@/lib/hr";

// Алба хаагчийн мэдээллийг засах. body: { rank?, name?, position?, active? } — халагдсан хүнийг устгахгүй,
// идэвхгүй (active: false) болгоно, тэгвэл ирц, харуул, манааны жагсаалтад гарахгүй.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isHrRole(await getCurrentRole())) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = parsePersonnel(body, true);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const update = { ...parsed.value, ...(typeof body?.active === "boolean" ? { active: body.active } : {}) };

  await connectToDatabase();
  const person = await Personnel.findByIdAndUpdate(id, update, { new: true, runValidators: true });
  if (!person) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  return NextResponse.json({ person });
}
