import "server-only";
import { stat } from "node:fs/promises";
import { connectToDatabase } from "@/lib/mongodb";
import ChatFile from "@/lib/models/ChatFile";
import { CHAT_FILE } from "@/lib/chat-shared";
import { deletePrivateFile, listPrivateFiles, privateFilePath } from "@/lib/storage";

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
