import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import News from "@/lib/models/News";
import { getCurrentRole } from "@/lib/auth-role";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connectToDatabase();
  const news = await News.findById(id).lean();
  if (!news) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });

  const role = await getCurrentRole();
  if (news.status !== "published" && !role) {
    return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  }

  return NextResponse.json({ news });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = await getCurrentRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { title, excerpt, content, imageUrl, status } = body ?? {};

  await connectToDatabase();
  const news = await News.findByIdAndUpdate(
    id,
    { title, excerpt, content, imageUrl, ...(status ? { status } : {}) },
    { new: true }
  );

  if (!news) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  return NextResponse.json({ news });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = await getCurrentRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  }

  const { id } = await params;
  await connectToDatabase();
  await News.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
