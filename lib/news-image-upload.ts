import { upload } from "@vercel/blob/client";
import { NEWS_IMAGE_MAX_MB, NEWS_IMAGE_TYPES } from "@/lib/images";

// Мэдээний зургийг browser-оос Vercel Blob руу шууд оруулах (нүүр зураг болон цомогт хоёуланд)

/** Файл тохирохгүй бол алдааны мессеж, тохирвол null */
export function newsImageError(file: File) {
  if (!NEWS_IMAGE_TYPES[file.type]) return "Зөвхөн JPG, PNG, WEBP, GIF зураг оруулна уу";
  if (file.size > NEWS_IMAGE_MAX_MB * 1024 * 1024) {
    return `Зургийн хэмжээ ${NEWS_IMAGE_MAX_MB}MB-аас ихгүй байх ёстой`;
  }
  return null;
}

/** Зургийг оруулж нийтийн хаягийг буцаана */
export async function uploadNewsImage(file: File, onProgress?: (percent: number) => void) {
  const blob = await upload(`news/${Date.now()}.${NEWS_IMAGE_TYPES[file.type]}`, file, {
    access: "public",
    handleUploadUrl: "/api/upload",
    contentType: file.type,
    onUploadProgress: ({ percentage }) => onProgress?.(Math.round(percentage)),
  });
  return blob.url;
}

export const NEWS_IMAGE_ACCEPT = Object.keys(NEWS_IMAGE_TYPES).join(",");
