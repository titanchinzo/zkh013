import { NextRequest, NextResponse } from "next/server";
import ChatFile from "@/lib/models/ChatFile";
import Personnel from "@/lib/models/Personnel";
import { CHAT_FILE, formatBytes } from "@/lib/chat-shared";
import { getChatUser, isUserId } from "@/lib/chat";
import { fileExpiry } from "@/lib/chat-files";
import { CHUNK_BYTES, createUploadSession, usesLocalStorage } from "@/lib/storage";

type Params = { params: Promise<{ userId: string }> };

/** Нэрийг хадгалж болохуйц болгоно: зам, удирдах тэмдэгтгүй, 200 тэмдэгт хүртэл */
const cleanName = (value: unknown) =>
  (typeof value === "string" ? value : "")
    .replace(/[\\/]/g, "_")
    // Удирдах тэмдэгт (мөр шилжүүлэх г.м) — толгой мэдээлэлд орохгүй
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(-200) || "файл";

/**
 * Тухайн хүнд файл илгээхийг эхлүүлнэ. body: { name, size, type } → { fileId, uploadId, chunkSize }.
 * Утас файлыг 4MB-аар хэсэгчлэн PUT /api/uploads/<uploadId>-руу илгээж дуусгаад, POST /api/app/chat/<userId>
 * { fileId }-аар зурвас болгон илгээнэ. Файл нийтэд нээгдэхгүй хувийн хавтсанд хадгалагдана.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await getChatUser();
  if ("error" in auth) return auth.error;
  const { me } = auth;
  const { userId: other } = await params;
  if (!isUserId(other) || other === me) return NextResponse.json({ error: "Хэрэглэгч олдсонгүй" }, { status: 404 });
  if (!usesLocalStorage()) return NextResponse.json({ error: "Энэ серверт файл илгээх боломжгүй" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const size = Number(body?.size);
  if (!Number.isInteger(size) || size <= 0) return NextResponse.json({ error: "Файл хоосон байна" }, { status: 400 });
  if (size > CHAT_FILE.maxBytes) {
    return NextResponse.json({ error: `Файлын хэмжээ ${formatBytes(CHAT_FILE.maxBytes)}-аас ихгүй байна` }, { status: 400 });
  }
  if (!(await Personnel.exists({ userId: other, active: true }))) {
    return NextResponse.json({ error: "Энэ хүнд файл илгээх боломжгүй" }, { status: 404 });
  }

  // Татагдаагүй файлууд серверт хуримтлагдахгүй
  const waiting = await ChatFile.find({ sender: me, status: { $in: ["uploading", "ready"] }, expiresAt: { $gt: new Date() } })
    .select("size")
    .lean<{ size: number }[]>();
  if (waiting.length >= CHAT_FILE.maxPending) {
    return NextResponse.json(
      { error: `Татагдаагүй ${CHAT_FILE.maxPending} файл байна — хүлээн авагчид татаж авсны дараа дахин илгээнэ үү` },
      { status: 429 }
    );
  }
  if (waiting.reduce((sum, f) => sum + f.size, 0) + size > CHAT_FILE.maxPendingBytes) {
    return NextResponse.json(
      { error: `Татагдаагүй файлуудын нийт хэмжээ ${formatBytes(CHAT_FILE.maxPendingBytes)}-аас хэтэрнэ` },
      { status: 429 }
    );
  }

  const file = await ChatFile.create({
    sender: me,
    recipient: other,
    name: cleanName(body?.name),
    size,
    type: typeof body?.type === "string" ? body.type.slice(0, 120) : "",
    status: "uploading",
    expiresAt: fileExpiry.uploading(),
  });
  const uploadId = await createUploadSession("chat-file", "", size, me, String(file._id));
  return NextResponse.json({ fileId: String(file._id), uploadId, chunkSize: CHUNK_BYTES }, { status: 201 });
}
