import { upload as uploadToBlob } from "@vercel/blob/client";
import { UPLOAD_KINDS, type UploadKind } from "@/lib/uploads";

// Browser-оос файл оруулах: серверийн дискэнд хадгалдаг бол 4MB-аар хэсэгчлэн (сүлжээ тасарвал тасарсан
// газраасаа үргэлжилнэ), Vercel дээр бол Vercel Blob руу шууд.

const RETRIES = 3;
const BLOB_MULTIPART_BYTES = 50 * 1024 * 1024;

async function errorOf(res: Response) {
  const data = await res.json().catch(() => ({}));
  return new Error(data.error ?? "Файл оруулахад алдаа гарлаа");
}

/** Хэсгийг илгээнэ; сүлжээний алдаа гарвал хэдэн удаа дахин оролдоно */
async function sendChunk(url: string, chunk: Blob) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(url, { method: "PUT", body: chunk });
    } catch (err) {
      if (attempt >= RETRIES) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

/**
 * Файлыг оруулж нийтийн хаягийг буцаана.
 * type нь файлын MIME төрөл (Windows дээр .docx зэргийн төрлийг browser хоосон өгдөг тул дуудагч тал тодорхойлно).
 */
export async function uploadFile(kind: UploadKind, file: File, type: string, onProgress?: (percent: number) => void) {
  const rule = UPLOAD_KINDS[kind];
  const start = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, type, size: file.size }),
  });
  if (!start.ok) throw await errorOf(start);
  const session = (await start.json()) as { mode: "local"; id: string; chunkSize: number } | { mode: "blob" };

  if (session.mode === "blob") {
    const blob = await uploadToBlob(`${rule.folder}/${Date.now()}.${rule.types[type]}`, file, {
      access: "public",
      handleUploadUrl: "/api/upload",
      contentType: type,
      multipart: file.size > BLOB_MULTIPART_BYTES,
      onUploadProgress: ({ percentage }) => onProgress?.(Math.round(percentage)),
    });
    return blob.url;
  }

  let offset = 0;
  for (;;) {
    const res = await sendChunk(
      `/api/uploads/${session.id}?offset=${offset}`,
      file.slice(offset, offset + session.chunkSize)
    );
    const data = await res.json().catch(() => ({}));
    // Өмнөх хэсэг серверт хүрсэн боловч хариу нь ирээгүй бол сервер өөрт байгаа хэмжээг хэлнэ
    if (res.status === 409 && typeof data.received === "number") {
      offset = data.received;
      continue;
    }
    if (!res.ok) throw new Error(data.error ?? "Файл оруулахад алдаа гарлаа");
    offset = data.received;
    onProgress?.(Math.round((offset / file.size) * 100));
    if (data.url) return data.url as string;
  }
}
