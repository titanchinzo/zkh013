import "server-only";
import { stat } from "node:fs/promises";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import ChatFile from "@/lib/models/ChatFile";
import { CHAT_FILE, formatBytes } from "@/lib/chat-shared";
import {
  CHUNK_BYTES,
  createUploadSession,
  deletePrivateFile,
  listPrivateFiles,
  privateFilePath,
  usesLocalStorage,
} from "@/lib/storage";

// Чатаар илгээсэн файлын амьдрал: оруулж байх үед 1 хоног, илгээгдсэний дараа CHAT_FILE.days хоног (татаж авахыг
// хүлээнэ), татаж авмагц диск дээрх файл устаж бичлэг нь илгээгч «Татаж авсан» гэж харах хугацаанд (30 хоног) үлдэнэ.

const DAY_MS = 24 * 60 * 60 * 1000;
export const fileExpiry = {
  uploading: () => new Date(Date.now() + DAY_MS),
  ready: () => new Date(Date.now() + CHAT_FILE.days * DAY_MS),
  downloaded: () => new Date(Date.now() + 30 * DAY_MS),
};

/** Файл бүхэлдээ оруулагдсан эсэх (диск дээрх хэмжээ таарч байна) */
export async function isUploaded(file: { _id: unknown; size: number }) {
  const full = privateFilePath(String(file._id));
  const info = full ? await stat(full).catch(() => null) : null;
  return Boolean(info && info.size === file.size);
}

/** Нэрийг хадгалж болохуйц болгоно: зам, удирдах тэмдэгтгүй, 200 тэмдэгт хүртэл */
const cleanName = (value: unknown) =>
  (typeof value === "string" ? value : "")
    .replace(/[\\/]/g, "_")
    // Удирдах тэмдэгт (мөр шилжүүлэх г.м) — толгой мэдээлэлд орохгүй
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(-200) || "файл";

/**
 * Чатаар (хүнд эсвэл бүлэгт) файл илгээхийг эхлүүлнэ. body: { name, size, type } → { fileId, uploadId, chunkSize }.
 * Утас файлыг 4MB-аар хэсэгчлэн PUT /api/uploads/<uploadId>-руу илгээж дуусгаад, зурвас болгон { fileId }-аар илгээнэ.
 * Файл нийтэд нээгдэхгүй хувийн хавтсанд хадгалагдана. Хүлээн авагчийг дуудагч нь урьдчилан шалгасан байна.
 */
export async function startChatFile(me: string, body: unknown, target: { recipient: string } | { group: string }) {
  if (!usesLocalStorage()) return NextResponse.json({ error: "Энэ серверт файл илгээх боломжгүй" }, { status: 503 });
  const b = (body ?? {}) as Record<string, unknown>;
  const size = Number(b.size);
  if (!Number.isInteger(size) || size <= 0) return NextResponse.json({ error: "Файл хоосон байна" }, { status: 400 });
  if (size > CHAT_FILE.maxBytes) {
    return NextResponse.json({ error: `Файлын хэмжээ ${formatBytes(CHAT_FILE.maxBytes)}-аас ихгүй байна` }, { status: 400 });
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
    ...target,
    name: cleanName(b.name),
    size,
    type: typeof b.type === "string" ? b.type.slice(0, 120) : "",
    status: "uploading",
    expiresAt: fileExpiry.uploading(),
  });
  const uploadId = await createUploadSession("chat-file", "", size, me, String(file._id));
  return NextResponse.json({ fileId: String(file._id), uploadId, chunkSize: CHUNK_BYTES }, { status: 201 });
}

/** Тухайн хүний илгээсэн, хүлээн авсан бүх чатын файлыг устгана (алба хаагчийг устгахад) */
export async function deleteChatFilesOf(userId: string) {
  const filter = { $or: [{ sender: userId }, { recipient: userId }] };
  const files = await ChatFile.find(filter).select("_id").lean<{ _id: unknown }[]>();
  await Promise.all(files.map((f) => deletePrivateFile(String(f._id))));
  await ChatFile.deleteMany(filter);
}

/** Бичлэг нь устсан (хугацаа дууссан) эсвэл татагдсан файлуудыг дискнээс цэвэрлэнэ */
export async function sweepChatFiles() {
  const names = await listPrivateFiles();
  if (!names.length) return 0;
  await connectToDatabase();
  const live = await ChatFile.find({ _id: { $in: names }, status: { $ne: "downloaded" }, expiresAt: { $gt: new Date() } })
    .select("_id")
    .lean<{ _id: unknown }[]>();
  const keep = new Set(live.map((f) => String(f._id)));
  const gone = names.filter((name) => !keep.has(name));
  await Promise.all(gone.map(deletePrivateFile));
  return gone.length;
}

/** Сервер асахад нэг удаа дуудна (instrumentation.ts) — цаг тутам цэвэрлэнэ */
export function startChatFileSweeper() {
  const g = globalThis as { __chatFileSweeper?: ReturnType<typeof setInterval> };
  if (g.__chatFileSweeper) return;
  const tick = () => sweepChatFiles().catch((err) => console.error("[chat] файл цэвэрлэж чадсангүй:", err));
  g.__chatFileSweeper = setInterval(tick, 60 * 60 * 1000);
  setTimeout(tick, 60_000);
}
