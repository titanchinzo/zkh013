// Мэдээний зургийн хаягийг шалгах туслах функцууд (server болон client аль алинд ажиллана)

// Vercel Blob-д upload хийсэн нийтийн зургууд энэ домэйн дээр байрладаг.
// next.config.ts-ийн images.remotePatterns-д бүртгэсэн тул Next.js optimize хийж чадна.
const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

/** next/image-д дамжуулж болох хаяг эсэх (буруу хаяг хуудсыг унагахаас сэргийлнэ) */
export function isUsableImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

/** Next.js-ээр optimize хийж болох эсэх: өөрийн /public зураг эсвэл Vercel Blob */
export function canOptimizeImage(url: string) {
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}
