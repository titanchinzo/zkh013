import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { resolveRole } from "@/lib/roles";
import { CHUNK_BYTES, createUploadSession, usesLocalStorage } from "@/lib/storage";
import { UPLOAD_KINDS, type UploadKind } from "@/lib/uploads";

// Файл оруулалт эхлүүлэх. body: { kind, type, size }
// Серверийн дискэнд хадгалдаг бол { mode: "local", id, chunkSize } — client файлыг хэсэгчлэн PUT /api/uploads/[id]
// руу илгээнэ. Vercel дээр { mode: "blob" } — client Vercel Blob руу шууд оруулна (/api/upload).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const rule = UPLOAD_KINDS[body?.kind as UploadKind];
  if (!rule) return NextResponse.json({ error: "Буруу төрлийн файл" }, { status: 400 });

  const user = await currentUser();
  const role = user
    ? resolveRole(user.publicMetadata as { role?: string }, user.primaryEmailAddress?.emailAddress)
    : null;
  if (!user || !role || !rule.roles.includes(role)) {
    return NextResponse.json({ error: "Файл оруулах эрхгүй байна" }, { status: 403 });
  }

  const ext = rule.types[body.type];
  if (!ext) return NextResponse.json({ error: "Энэ төрлийн файл зөвшөөрөгдөхгүй" }, { status: 400 });
  const size = Number(body.size);
  if (!Number.isInteger(size) || size <= 0 || size > rule.maxMb * 1024 * 1024) {
    return NextResponse.json({ error: `Файлын хэмжээ ${rule.maxMb}MB-аас ихгүй байх ёстой` }, { status: 400 });
  }

  if (!usesLocalStorage()) return NextResponse.json({ mode: "blob" });
  const id = await createUploadSession(body.kind, ext, size, user.id);
  return NextResponse.json({ mode: "local", id, chunkSize: CHUNK_BYTES });
}
