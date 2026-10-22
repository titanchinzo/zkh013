import "server-only";
import { isLocalUploadUrl, isStoredFileUrl } from "@/lib/images";
import { deleteFile } from "@/lib/storage";
import { NEWS_MAX_VIDEOS, UPLOAD_KINDS } from "@/lib/uploads";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const VIDEO_FOLDER = `/${UPLOAD_KINDS["news-video"].folder}/`;

/** Мэдээний бичлэгүүдийн жагсаалтыг шалгана — зөвхөн манайд оруулсан бичлэг (гадны хаяг биш) */
export function parseNewsVideos(raw: unknown): Result<string[]> {
  if (raw == null) return { ok: true, value: [] };
  if (!Array.isArray(raw) || raw.length > NEWS_MAX_VIDEOS) {
    return { ok: false, error: `Нэг мэдээнд ${NEWS_MAX_VIDEOS} хүртэл бичлэг оруулна` };
  }
  const valid = raw.every(
    (url) => typeof url === "string" && isStoredFileUrl(url) && new URL(url, "http://local").pathname.includes(VIDEO_FOLDER)
  );
  return valid ? { ok: true, value: [...new Set(raw as string[])] } : { ok: false, error: "Бичлэгээ дахин оруулна уу" };
}

type NewsFiles = { imageUrl?: string | null; images?: string[] | null; videos?: string[] | null };

const filesOf = (news: NewsFiles) => [news.imageUrl ?? "", ...(news.images ?? []), ...(news.videos ?? [])];

/**
 * Мэдээнээс хасагдсан (эсвэл мэдээ устсан үед бүх) серверийн файлыг устгана — том бичлэгүүд дискийг
 * дүүргэхгүйн тулд. Vercel Blob-ийн файлд хүрэхгүй. Алдаа гарсан ч үндсэн үйлдлийг зогсоохгүй.
 */
export async function deleteRemovedFiles(before: NewsFiles, after: NewsFiles | null) {
  const kept = new Set(after ? filesOf(after) : []);
  const removed = [...new Set(filesOf(before))].filter((url) => isLocalUploadUrl(url) && !kept.has(url));
  await Promise.all(
    removed.map((url) => deleteFile(url).catch((err) => console.error("[news] файл устгаж чадсангүй:", url, err)))
  );
}
