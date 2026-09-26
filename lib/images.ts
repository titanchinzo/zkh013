// Мэдээний зургийн хаягийг шалгах туслах функцууд (server болон client аль алинд ажиллана)

// Vercel Blob-д upload хийсэн нийтийн файлууд энэ домэйн дээр байрладаг.
// next.config.ts-ийн images.remotePatterns-д бүртгэсэн тул Next.js optimize хийж чадна.
const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

// Мэдээний зурагт зөвшөөрөгдөх төрлүүд (MIME -> өргөтгөл)
export const NEWS_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
export const NEWS_IMAGE_MAX_MB = 15;

/** next/image-д дамжуулж болох хаяг эсэх (буруу хаяг хуудсыг унагахаас сэргийлнэ) */
export function isUsableImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  return isHttpUrl(url);
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

/** Next.js-ээр optimize хийж болох эсэх: өөрийн /public зураг эсвэл Vercel Blob */
export function canOptimizeImage(url: string) {
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  return isVercelBlobUrl(url);
}
