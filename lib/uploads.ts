// Сайт руу оруулах файлууд (мэдээний зураг, бичлэг, сургалтын материал) — server болон client аль алинд ажиллана

import { NEWS_IMAGE_MAX_MB, NEWS_IMAGE_TYPES } from "@/lib/images";
import type { Role } from "@/lib/roles";
import { TRAINING_FILE_TYPES, TRAINING_MAX_MB } from "@/lib/training";

// Мэдээний бичлэг (MIME -> өргөтгөл). Хөтөч бүр тоглуулж чаддаг формат.
export const NEWS_VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};
export const NEWS_VIDEO_MAX_MB = 2048;
// Нэг мэдээнд оруулах бичлэгийн дээд тоо
export const NEWS_MAX_VIDEOS = 5;
export const NEWS_VIDEO_ACCEPT = [...Object.keys(NEWS_VIDEO_TYPES), ".mp4", ".webm", ".mov"].join(",");

export type UploadKind = "news-image" | "news-video" | "training";

type UploadRule = {
  folder: string; // хадгалах хавтас (Vercel Blob-ийн замын эхний хэсэг ч мөн)
  types: Record<string, string>; // MIME -> өргөтгөл
  maxMb: number;
  roles: NonNullable<Role>[];
};

// Мэдээ оруулдаг бүх эрх (нийтлэгч ч мэдээндээ зураг, бичлэг оруулна)
const NEWS_ROLES: UploadRule["roles"] = ["admin", "moderator", "publisher"];

export const UPLOAD_KINDS: Record<UploadKind, UploadRule> = {
  "news-image": { folder: "news", types: NEWS_IMAGE_TYPES, maxMb: NEWS_IMAGE_MAX_MB, roles: NEWS_ROLES },
  "news-video": { folder: "videos", types: NEWS_VIDEO_TYPES, maxMb: NEWS_VIDEO_MAX_MB, roles: NEWS_ROLES },
  training: {
    folder: "training",
    types: Object.fromEntries(Object.entries(TRAINING_FILE_TYPES).map(([ext, { mime }]) => [mime, ext])),
    maxMb: TRAINING_MAX_MB,
    roles: ["admin"],
  },
};

/** Vercel Blob-ийн замын эхний хэсгээр (news/, videos/, training/) файлын төрлийг олно */
export function uploadKindOfFolder(folder: string): UploadKind | null {
  const found = Object.entries(UPLOAD_KINDS).find(([, rule]) => rule.folder === folder);
  return found ? (found[0] as UploadKind) : null;
}

/** Хадгалсан файлын хаягаас MIME төрлийг өргөтгөлөөр нь олно (файл дамжуулахад) */
export function contentTypeOfExt(ext: string): string | null {
  for (const rule of Object.values(UPLOAD_KINDS)) {
    const found = Object.entries(rule.types).find(([, value]) => value === ext);
    if (found) return found[0];
  }
  return null;
}
