// Мэдээний зургийн хаягийг шалгах туслах функцууд (server болон client аль алинд ажиллана)

// Vercel Blob-д upload хийсэн нийтийн файлууд энэ домэйн дээр байрладаг.
// next.config.ts-ийн images.remotePatterns-д бүртгэсэн тул Next.js optimize хийж чадна.
const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";
// YouTube видеоны зураг (мэдээнд YouTube холбоос оруулахад автоматаар бөглөгдөнө)
const YOUTUBE_THUMB_HOST = "i.ytimg.com";

// Мэдээний зурагт зөвшөөрөгдөх төрлүүд (MIME -> өргөтгөл)
export const NEWS_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
export const NEWS_IMAGE_MAX_MB = 15;
// Нэг мэдээний зургийн цомогт оруулах дээд тоо
export const NEWS_MAX_IMAGES = 30;

// Зураг биш, вэб хуудасны домэйнууд — Facebook/YouTube-ийн хуудасны холбоосыг зураг гэж
// харуулбал эвдэрсэн зураг гардаг тул ялгана
const WEB_PAGE_HOST = /(^|\.)(facebook\.com|fb\.com|fb\.watch|youtube\.com|youtu\.be|instagram\.com)$/i;

/** next/image-д дамжуулж болох хаяг эсэх (буруу хаяг хуудсыг унагахаас сэргийлнэ) */
export function isUsableImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  return isHttpUrl(url) && !WEB_PAGE_HOST.test(new URL(url).hostname);
}

/** Facebook-ийн зургийн CDN (хаяг нь хэд хоногийн дараа хүчингүй болдог тул хадгалахдаа хуулна) */
export function isFacebookCdnUrl(url: string) {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && hostname.endsWith(".fbcdn.net");
  } catch {
    return false;
  }
}

export function isHttpUrl(url: string) {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

/** Манай Vercel Blob store дээрх файл эсэх */
export function isVercelBlobUrl(url: string) {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

// Серверийн дискэнд (UPLOAD_DIR) хадгалсан файлууд энэ замаар нээгдэнэ
export const LOCAL_UPLOAD_PREFIX = "/uploads/";

/** Манай серверийн дискэнд хадгалсан файл эсэх (/uploads/news/...) */
export function isLocalUploadUrl(url: string) {
  return url.startsWith(LOCAL_UPLOAD_PREFIX) && !url.includes("..") && !url.includes("\\");
}

/** Сайтын өөрөө хадгалсан файл эсэх — серверийн дискэнд эсвэл Vercel Blob-д */
export function isStoredFileUrl(url: string) {
  return isLocalUploadUrl(url) || isVercelBlobUrl(url);
}

/** Next.js-ээр optimize хийж болох эсэх: өөрийн /public зураг, Vercel Blob эсвэл YouTube-ийн зураг */
export function canOptimizeImage(url: string) {
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  if (isVercelBlobUrl(url)) return true;
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && hostname === YOUTUBE_THUMB_HOST;
  } catch {
    return false;
  }
}
