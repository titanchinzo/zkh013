import { NEWS_IMAGE_MAX_MB, NEWS_IMAGE_TYPES } from "@/lib/images";
import { uploadFile } from "@/lib/upload-client";

// Мэдээний зургийг browser-оос оруулах (нүүр зураг болон цомогт хоёуланд)

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
  return uploadFile("news-image", file, file.type, onProgress);
}

export const NEWS_IMAGE_ACCEPT = Object.keys(NEWS_IMAGE_TYPES).join(",");

/**
 * Facebook-ийн зураг/пост/видеоны холбоосоос зургийг нь олно. Буцаасан хаяг нь түр (fbcdn)
 * бөгөөд мэдээг хадгалахад сервер манай Blob руу хуулна.
 */
export async function imageFromFacebookLink(url: string) {
  const res = await fetch(`/api/media/preview?url=${encodeURIComponent(url)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Холбоосыг шалгаж чадсангүй");
  if (!data.thumbnailUrl) throw new Error("Энэ холбоосноос зураг олдсонгүй. Пост нь Public эсэхийг шалгана уу.");
  return data.thumbnailUrl as string;
}
