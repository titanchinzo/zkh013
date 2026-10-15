import "server-only";
import { put } from "@vercel/blob";
import {
  isFacebookCdnUrl,
  isUsableImageUrl,
  NEWS_IMAGE_MAX_MB,
  NEWS_IMAGE_TYPES,
  NEWS_MAX_IMAGES,
} from "@/lib/images";
import { isFacebookUrl, parseMediaUrl } from "@/lib/media";
import { facebookPreviewImage, resolveMedia } from "@/lib/media-server";

// Мэдээ хадгалахад зургийн хаягуудыг шалгаж, Facebook-ийн зургийг манай Vercel Blob руу хуулна
// (Facebook CDN-ий хаяг хэд хоногийн дараа хүчингүй болж зураг эвдэрдэг)

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const IMAGE_URL_ERROR = "Зургийн холбоос буруу байна";
const FACEBOOK_IMAGE_ERROR = "Facebook-ээс зургийг татаж чадсангүй. Зургаа компьютерээсээ оруулна уу.";
const DOWNLOAD_TIMEOUT_MS = 15000;

/** Нүүр зураг болон цомгийг нэг хүсэлт дотор бэлтгэнэ (нэг зургийг хоёр удаа хуулахгүй) */
export function createImagePreparer() {
  const imported = new Map<string, Promise<string | null>>();

  async function image(raw: unknown): Promise<Result<string>> {
    if (raw == null || raw === "") return { ok: true, value: "" };
    if (typeof raw !== "string") return { ok: false, error: IMAGE_URL_ERROR };
    const url = raw.trim();

    if (isFacebookCdnUrl(url) || isFacebookUrl(url)) {
      if (!imported.has(url)) imported.set(url, importFacebookImage(url));
      const stored = await imported.get(url)!;
      return stored ? { ok: true, value: stored } : { ok: false, error: FACEBOOK_IMAGE_ERROR };
    }
    return isUsableImageUrl(url) ? { ok: true, value: url } : { ok: false, error: IMAGE_URL_ERROR };
  }

  async function list(raw: unknown): Promise<Result<string[]>> {
    if (raw == null) return { ok: true, value: [] };
    if (!Array.isArray(raw) || raw.length > NEWS_MAX_IMAGES) {
      return { ok: false, error: `Зургийн цомогт ${NEWS_MAX_IMAGES} хүртэл зураг оруулна` };
    }
    const urls: string[] = [];
    for (const item of raw) {
      const result = await image(item);
      if (!result.ok) return result;
      if (result.value) urls.push(result.value);
    }
    return { ok: true, value: urls };
  }

  return { image, list };
}

/** Facebook-ийн зураг (CDN хаяг эсвэл зураг/видео/постын холбоос)-ийг Blob руу хуулж байнгын хаяг буцаана */
async function importFacebookImage(url: string): Promise<string | null> {
  try {
    let source: string | null = url;
    if (!isFacebookCdnUrl(url)) {
      const media = parseMediaUrl(url);
      source = await facebookPreviewImage(media ? (await resolveMedia(media)).href : url);
    }
    if (!source) return null;

    const res = await fetch(source, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    const contentType = res.headers.get("content-type")?.split(";")[0].trim() ?? "";
    const ext = NEWS_IMAGE_TYPES[contentType];
    if (!res.ok || !ext) return null;

    const data = await res.arrayBuffer();
    if (data.byteLength > NEWS_IMAGE_MAX_MB * 1024 * 1024) return null;

    const blob = await put(`news/facebook-${Date.now()}.${ext}`, data, {
      access: "public",
      addRandomSuffix: true,
      contentType,
    });
    return blob.url;
  } catch (err) {
    console.warn("[image-import] Facebook-ийн зургийг хуулж чадсангүй:", err);
    return null;
  }
}
