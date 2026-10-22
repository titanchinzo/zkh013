import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { appendChunk, CHUNK_BYTES } from "@/lib/storage";

// Файлын дараагийн хэсэг: PUT /api/uploads/[id]?offset=<серверт ирсэн байт>, body нь хэсгийн өгөгдөл.
// Эрхийг оруулалт эхлүүлэхэд шалгасан; энд тухайн хэрэглэгчийнх эсэхийг л шалгана (Clerk API дуудахгүй).
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });

  const offset = Number(req.nextUrl.searchParams.get("offset"));
  const chunk = Buffer.from(await req.arrayBuffer());
  if (!Number.isInteger(offset) || offset < 0 || chunk.length === 0 || chunk.length > CHUNK_BYTES) {
    return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });
  }

  const result = await appendChunk((await params).id, userId, offset, chunk);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, received: result.received }, { status: result.status });
  }
  return NextResponse.json({ received: result.received, url: result.url });
}
