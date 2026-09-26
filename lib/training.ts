// Сургалтын материалын файлын төрлүүд (server болон client аль алинд ашиглана)

import { isHttpUrl, isVercelBlobUrl } from "@/lib/images";

export const TRAINING_FILE_TYPES = {
  pdf: { mime: "application/pdf", label: "PDF" },
  doc: { mime: "application/msword", label: "Word" },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    label: "Word",
  },
  ppt: { mime: "application/vnd.ms-powerpoint", label: "PowerPoint" },
  pptx: {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    label: "PowerPoint",
  },
  xls: { mime: "application/vnd.ms-excel", label: "Excel" },
  xlsx: {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    label: "Excel",
  },
} as const;

export type TrainingFileExt = keyof typeof TRAINING_FILE_TYPES;
export type TrainingKind = "file" | "link";

export const TRAINING_MAX_MB = 50;

// Windows дээр Office суулгаагүй үед browser .docx зэргийн MIME төрлийг хоосон өгдөг тул
// файлын төрлийг өргөтгөлөөр нь тодорхойлно.
export function trainingExtOf(fileName: string): TrainingFileExt | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return ext in TRAINING_FILE_TYPES ? (ext as TrainingFileExt) : null;
}

export function formatFileSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export type TrainingInput = {
  title: string;
  description: string;
  kind: TrainingKind;
  url: string;
  fileName: string;
  fileExt: string;
  fileSize: number;
};

/** API-д ирсэн өгөгдлийг шалгаж цэвэрлэнэ. Буруу бол { error } буцаана. */
export function parseTrainingInput(body: unknown): { data: TrainingInput } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim() : "";
  const description = typeof b.description === "string" ? b.description.trim() : "";
  const url = typeof b.url === "string" ? b.url.trim() : "";
  const kind = b.kind;

  if (!title) return { error: "Гарчгийг бөглөнө үү" };
  if (kind !== "file" && kind !== "link") return { error: "Материалын төрөл буруу" };

  if (kind === "link") {
    if (!isHttpUrl(url)) return { error: "Холбоос https://... хэлбэртэй байх ёстой" };
    return { data: { title, description, kind, url, fileName: "", fileExt: "", fileSize: 0 } };
  }

  const fileExt = typeof b.fileExt === "string" ? b.fileExt.toLowerCase() : "";
  if (!isVercelBlobUrl(url)) return { error: "Файлаа дахин оруулна уу" };
  if (!(fileExt in TRAINING_FILE_TYPES)) return { error: "Энэ төрлийн файл зөвшөөрөгдөхгүй" };
  const fileName = typeof b.fileName === "string" ? b.fileName.trim() : "";
  const fileSize = typeof b.fileSize === "number" && b.fileSize > 0 ? b.fileSize : 0;
  return { data: { title, description, kind, url, fileName, fileExt, fileSize } };
}
