import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextRequest } from "next/server";
import { localFilePath, usesLocalStorage } from "@/lib/storage";
import { contentTypeOfExt } from "@/lib/uploads";

// Серверийн дискэнд хадгалсан файлууд (/uploads/...). Production-д nginx өөрөө шууд өгдөг; энэ нь
// локал хөгжүүлэлт болон next/image зургийг жижгэрүүлэхэд (дотоод хүсэлт) ашиглагдана.
// Бичлэгийг гүйлгэж үзэхэд хэрэгтэй Range хүсэлтийг дэмжинэ.
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  const notFound = new Response("Not found", { status: 404 });
  if (!usesLocalStorage() || parts.some((part) => part.startsWith("."))) return notFound;

  const file = localFilePath(parts.join("/"));
  const type = file ? contentTypeOfExt(path.extname(file).slice(1).toLowerCase()) : null;
  const info = file && type ? await stat(file).catch(() => null) : null;
  if (!file || !type || !info?.isFile()) return notFound;

  const headers: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    // Файлын нэр давтагдашгүй тул хөтөч удаан хадгална
    "Cache-Control": "public, max-age=31536000, immutable",
  };

  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
    if (start > end || start >= info.size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
    }
    const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${info.size}`, "Content-Length": String(end - start + 1) },
    });
  }

  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, "Content-Length": String(info.size) } });
}
