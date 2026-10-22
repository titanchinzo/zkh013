import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, open, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";
import { isLocalUploadUrl, isVercelBlobUrl, LOCAL_UPLOAD_PREFIX } from "@/lib/images";
import { UPLOAD_KINDS, type UploadKind } from "@/lib/uploads";

// Файл хадгалах газар: UPLOAD_DIR тохируулсан бол серверийн дискэнд (/uploads/... хаягаар нээгдэнэ),
// үгүй бол (Vercel) Vercel Blob-д. Хэсэгчлэн оруулж буй файлууд UPLOAD_DIR-ийн хажуугийн upload-tmp-д
// түр байна (нийтэд нээгдэхгүй, нэг дискэнд тул эцэст нь зөөхөд хуулах шаардлагагүй).
const UPLOAD_DIR = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : null;
const TMP_DIR = UPLOAD_DIR ? path.join(path.dirname(UPLOAD_DIR), "upload-tmp") : null;

// Нэг хэсгийн хэмжээ: Next.js proxy хүсэлтийн биеийг 10MB хүртэл л санах ойд хадгалдаг тул түүнээс бага
export const CHUNK_BYTES = 4 * 1024 * 1024;
// Дуусаагүй орхисон оруулалтыг устгах хугацаа
const STALE_MS = 24 * 60 * 60 * 1000;

export function usesLocalStorage() {
  return UPLOAD_DIR !== null;
}

function newRelativePath(folder: string, ext: string) {
  return `${folder}/${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
}

/** UPLOAD_DIR доторх бүрэн зам. Хавтсаас гадагш гарах (../) зам бол null. */
export function localFilePath(relative: string) {
  if (!UPLOAD_DIR) return null;
  const full = path.resolve(UPLOAD_DIR, relative);
  return full.startsWith(UPLOAD_DIR + path.sep) ? full : null;
}

/** Серверт татсан файлыг (жишээ нь Facebook-ийн зураг) хадгалж нийтийн хаягийг буцаана */
export async function saveFile(folder: string, ext: string, data: ArrayBuffer, contentType: string) {
  if (UPLOAD_DIR) {
    const relative = newRelativePath(folder, ext);
    const full = localFilePath(relative)!;
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, Buffer.from(data));
    return LOCAL_UPLOAD_PREFIX + relative;
  }
  const blob = await put(`${folder}/upload.${ext}`, data, { access: "public", addRandomSuffix: true, contentType });
  return blob.url;
}

/** Хадгалсан файлыг устгана (олдохгүй бол алдаа гаргахгүй) */
export async function deleteFile(url: string) {
  if (isLocalUploadUrl(url)) {
    const full = localFilePath(url.slice(LOCAL_UPLOAD_PREFIX.length));
    if (full) await rm(full, { force: true });
  } else if (isVercelBlobUrl(url)) {
    await del(url);
  }
}

/* ---------- Том файлыг (бичлэг) хэсэгчлэн оруулах ---------- */

type UploadSession = { kind: UploadKind; target: string; size: number; userId: string };

const sessionFiles = (id: string) => ({
  meta: path.join(TMP_DIR!, `${id}.json`),
  part: path.join(TMP_DIR!, `${id}.part`),
});

/** Хуучирсан (24 цагаас дээш дуусаагүй) оруулалтуудыг цэвэрлэнэ */
async function sweepStaleSessions() {
  const now = Date.now();
  for (const name of await readdir(TMP_DIR!)) {
    const file = path.join(TMP_DIR!, name);
    const info = await stat(file).catch(() => null);
    if (info && now - info.mtimeMs > STALE_MS) await rm(file, { force: true });
  }
}

/** Оруулалт эхлүүлж id буцаана. Файлын төрөл, хэмжээг дуудагч тал шалгасан байна. */
export async function createUploadSession(kind: UploadKind, ext: string, size: number, userId: string) {
  await mkdir(TMP_DIR!, { recursive: true });
  await sweepStaleSessions();
  const id = randomBytes(16).toString("hex");
  const session: UploadSession = { kind, target: newRelativePath(UPLOAD_KINDS[kind].folder, ext), size, userId };
  const files = sessionFiles(id);
  await writeFile(files.meta, JSON.stringify(session));
  await writeFile(files.part, "");
  return id;
}

// Файлын эхний байтууд (өргөтгөлтэй таарч байгаа эсэх — нэрийг нь сольсон өөр төрлийн файлыг хүлээж авахгүй)
const ascii = (bytes: Buffer, from: number, to: number) => bytes.subarray(from, to).toString("latin1");
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // .doc, .xls, .ppt
const isZip = (b: Buffer) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04; // .docx, .xlsx, .pptx
const SIGNATURES: Record<string, (b: Buffer) => boolean> = {
  jpg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  png: (b) => ascii(b, 1, 4) === "PNG",
  gif: (b) => ascii(b, 0, 4) === "GIF8",
  webp: (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP",
  mp4: (b) => ascii(b, 4, 8) === "ftyp",
  mov: (b) => ["ftyp", "moov", "mdat", "wide", "free", "skip"].includes(ascii(b, 4, 8)),
  webm: (b) => b.length >= 4 && b.readUInt32BE(0) === 0x1a45dfa3,
  pdf: (b) => ascii(b, 0, 5) === "%PDF-",
  docx: isZip,
  xlsx: isZip,
  pptx: isZip,
  doc: (b) => b.subarray(0, 8).equals(OLE),
  xls: (b) => b.subarray(0, 8).equals(OLE),
  ppt: (b) => b.subarray(0, 8).equals(OLE),
};

export type ChunkResult =
  | { ok: true; received: number; url?: string }
  | { ok: false; status: number; error: string; received?: number };

/**
 * Дараагийн хэсгийг нэмнэ. offset нь серверт байгаа хэмжээтэй таарах ёстой — таарахгүй бол (сүлжээ
 * тасарч дахин илгээсэн гэх мэт) серверт байгаа хэмжээг буцааж, client тэндээс үргэлжлүүлнэ.
 * Сүүлийн хэсэг ирэхэд файлыг байранд нь зөөж нийтийн хаягийг (url) буцаана.
 */
export async function appendChunk(id: string, userId: string, offset: number, chunk: Buffer): Promise<ChunkResult> {
  const notFound = { ok: false, status: 404, error: "Оруулалт олдсонгүй. Файлаа дахин сонгоно уу." } as const;
  if (!TMP_DIR || !/^[a-f0-9]{32}$/.test(id)) return notFound;
  const files = sessionFiles(id);
  // turbopackIgnore: UPLOAD_DIR нь ажиллах үеийн өгөгдлийн хавтас — build-ийн file tracing-д хамааралгүй
  const raw = await readFile(/*turbopackIgnore: true*/ files.meta, "utf8").catch(() => null);
  if (!raw) return notFound;
  const session = JSON.parse(raw) as UploadSession;
  if (session.userId !== userId) return notFound;

  const received = (await stat(/*turbopackIgnore: true*/ files.part)).size;
  if (offset !== received) return { ok: false, status: 409, error: "Хэсгийн байрлал таарахгүй байна", received };
  if (received + chunk.length > session.size) return { ok: false, status: 400, error: "Файлын хэмжээ таарахгүй байна" };
  if (received === 0) {
    const ext = path.extname(session.target).slice(1);
    if (!SIGNATURES[ext]?.(chunk)) {
      await Promise.all([rm(files.meta, { force: true }), rm(files.part, { force: true })]);
      return { ok: false, status: 400, error: "Файлын агуулга сонгосон төрөлтэйгөө таарахгүй байна" };
    }
  }

  const handle = await open(/*turbopackIgnore: true*/ files.part, "a");
  try {
    await handle.write(chunk);
  } finally {
    await handle.close();
  }
  const total = received + chunk.length;
  if (total < session.size) return { ok: true, received: total };

  const final = localFilePath(session.target)!;
  await mkdir(path.dirname(final), { recursive: true });
  await rename(files.part, final);
  await rm(files.meta, { force: true });
  return { ok: true, received: total, url: LOCAL_UPLOAD_PREFIX + session.target };
}
