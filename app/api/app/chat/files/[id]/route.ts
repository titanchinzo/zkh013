import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import ChatFile from "@/lib/models/ChatFile";
import { getChatUser } from "@/lib/chat";
import { fileExpiry } from "@/lib/chat-files";
import { loadGroup, markGroupDownload } from "@/lib/chat-group";
import { deletePrivateFile, privateFilePath } from "@/lib/storage";

type FileDoc = {
  _id: unknown;
  sender: string;
  recipient?: string;
  group?: string;
  downloadedBy?: string[];
  name: string;
  size: number;
  type: string;
  status: string;
  expiresAt: Date;
};

// Зураг, бичлэг, дуу, PDF-ийг утас өөрийн программаар нээх боломжтой төрлөөр нь; бусдыг (HTML г.м) зөвхөн файл болгон
const SAFE_TYPE = /^(image\/(jpeg|png|gif|webp|heic|heif)|video\/[\w.+-]+|audio\/[\w.+-]+|application\/pdf)$/;

/**
 * Чатаар ирсэн файлыг татна — зөвхөн хүлээн авагч. Бүрэн татагдмагц серверээс устна (дахин татах боломжгүй).
 * Үргэлж «хавсралт» хэлбэрээр өгнө — хөтөч дотроо нээж ажиллуулахгүй.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getChatUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const notFound = NextResponse.json({ error: "Файл олдсонгүй" }, { status: 404 });
  if (!isValidObjectId(id)) return notFound;

  const file = await ChatFile.findById(id).lean<FileDoc>();
  if (!file) return notFound;
  // Бүлгийн файлыг гишүүн бүр (илгээгчээс бусад) нэг удаа татна; хүний чатын файлыг зөвхөн хүлээн авагч
  const allowed = file.group ? file.sender !== auth.me && Boolean(await loadGroup(file.group, auth.me)) : file.recipient === auth.me;
  if (!allowed) return notFound;
  if (file.status === "downloaded" || file.downloadedBy?.includes(auth.me)) {
    return NextResponse.json({ error: "Энэ файлыг аль хэдийн татаж авсан тул серверээс устсан" }, { status: 410 });
  }
  const full = privateFilePath(id);
  const info = full && file.status === "ready" && file.expiresAt > new Date() ? await stat(full).catch(() => null) : null;
  if (!full || !info) return NextResponse.json({ error: "Файлын хугацаа дууссан эсвэл устсан" }, { status: 410 });

  const stream = createReadStream(full);
  // Сүүлийн байт хүртэл илгээгдмэгц устгана; дундуур тасарвал (end ирэхгүй) дахин татаж болно
  stream.on("end", () => {
    // Бүлгийн файл бүх гишүүн татмагц устна
    const done = file.group
      ? markGroupDownload(id, auth.me)
      : ChatFile.updateOne(
          { _id: id, status: "ready" },
          { $set: { status: "downloaded", downloadedAt: new Date(), expiresAt: fileExpiry.downloaded() } }
        ).then(() => deletePrivateFile(id));
    done.catch((err) => console.error("[chat] татсан файлыг устгаж чадсангүй:", err));
  });

  const ascii = file.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": SAFE_TYPE.test(file.type) ? file.type : "application/octet-stream",
      "Content-Length": String(info.size),
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      // nginx хариуг өөртөө буферлэхгүй — утас бодитоор татаж дуусахад л «татаж авсан» гэж тооцож устгана
      "X-Accel-Buffering": "no",
    },
  });
}

/** Хүлээн авагч татаагүй файлтай зурвасаа өөрөөсөө устгахад файлыг серверээс устгана (дахин татах боломжгүй болсон) */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getChatUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Файл олдсонгүй" }, { status: 404 });
  const shared = await ChatFile.findOne({ _id: id, group: { $type: "string" } })
    .select("group sender")
    .lean<{ group: string; sender: string }>();
  if (shared) {
    // Бүлгийн файлыг бусад гишүүд татаж болно — зөвхөн намайг «татсан» гэж тэмдэглэнэ (бүгд татмагц устна)
    if (shared.sender !== auth.me && (await loadGroup(shared.group, auth.me))) await markGroupDownload(id, auth.me);
  } else {
    const file = await ChatFile.findOneAndDelete({ _id: id, recipient: auth.me }).select("_id").lean();
    if (file) await deletePrivateFile(id);
  }
  return NextResponse.json({ ok: true });
}
