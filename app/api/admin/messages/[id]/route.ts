import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import ContactMessage from "@/lib/models/ContactMessage";
import { getCurrentRole } from "@/lib/auth-role";

async function guard(params: Promise<{ id: string }>) {
  if ((await getCurrentRole()) !== "admin") return { error: NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 }) };
  const { id } = await params;
  if (!isValidObjectId(id)) return { error: NextResponse.json({ error: "Олдсонгүй" }, { status: 404 }) };
  await connectToDatabase();
  return { id };
}

/** Уншсан/уншаагүй болгох. body: { read: boolean } */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(params);
  if (g.error) return g.error;
  const { read } = (await req.json().catch(() => null)) ?? {};
  if (typeof read !== "boolean") return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });
  const updated = await ContactMessage.findByIdAndUpdate(g.id, { read }, { new: true });
  if (!updated) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(params);
  if (g.error) return g.error;
  await ContactMessage.findByIdAndDelete(g.id);
  return NextResponse.json({ ok: true });
}
