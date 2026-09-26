"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { Input, Textarea } from "@/components/ui/input";
import {
  TRAINING_FILE_TYPES,
  TRAINING_MAX_MB,
  formatFileSize,
  trainingExtOf,
  type TrainingKind,
} from "@/lib/training";

export type TrainingMaterialValues = {
  _id?: string;
  title: string;
  description: string;
  kind: TrainingKind;
  url: string;
  fileName: string;
  fileExt: string;
  fileSize: number;
};

const EMPTY: TrainingMaterialValues = {
  title: "",
  description: "",
  kind: "file",
  url: "",
  fileName: "",
  fileExt: "",
  fileSize: 0,
};

const ACCEPT = Object.keys(TRAINING_FILE_TYPES)
  .map((ext) => `.${ext}`)
  .join(",");

type UploadedFile = Pick<TrainingMaterialValues, "url" | "fileName" | "fileExt" | "fileSize">;

export function TrainingMaterialForm({ initial }: { initial?: TrainingMaterialValues }) {
  const router = useRouter();
  const start = initial ?? EMPTY;
  const [kind, setKind] = useState<TrainingKind>(start.kind);
  const [file, setFile] = useState<UploadedFile | null>(
    start.kind === "file" && start.url ? start : null
  );
  const [linkUrl, setLinkUrl] = useState(start.kind === "link" ? start.url : "");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploading = progress !== null;

  async function handleFile(picked: File) {
    setError("");
    const ext = trainingExtOf(picked.name);
    if (!ext) {
      setError("Зөвхөн PDF, Word, PowerPoint, Excel файл оруулна уу");
      return;
    }
    if (picked.size > TRAINING_MAX_MB * 1024 * 1024) {
      setError(`Файлын хэмжээ ${TRAINING_MAX_MB}MB-аас ихгүй байх ёстой`);
      return;
    }

    setProgress(0);
    try {
      const blob = await upload(`training/${Date.now()}.${ext}`, picked, {
        access: "public",
        handleUploadUrl: "/api/upload",
        contentType: TRAINING_FILE_TYPES[ext].mime,
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });
      setFile({ url: blob.url, fileName: picked.name, fileExt: ext, fileSize: picked.size });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Файл оруулахад алдаа гарлаа");
    } finally {
      setProgress(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (kind === "file" && !file) {
      setError("Файлаа сонгож оруулна уу");
      return;
    }

    const form = new FormData(e.currentTarget);
    const payload = {
      title: form.get("title"),
      description: form.get("description"),
      kind,
      ...(kind === "file" ? file : { url: linkUrl }),
    };

    setSubmitting(true);
    const res = await fetch(initial?._id ? `/api/training/${initial._id}` : "/api/training", {
      method: initial?._id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Алдаа гарлаа");
      return;
    }
    router.push("/admin/training");
    router.refresh();
  }

  const tabClass = (active: boolean) =>
    `px-4 h-10 rounded-md text-sm font-semibold border transition-colors ${
      active
        ? "bg-primary text-primary-foreground border-primary"
        : "border-border text-muted-foreground hover:text-foreground"
    }`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-foreground mb-2">Гарчиг</label>
        <Input name="title" defaultValue={start.title} required />
      </div>
      <div>
        <label className="block text-sm font-semibold text-foreground mb-2">Тайлбар (заавал биш)</label>
        <Textarea name="description" defaultValue={start.description} className="min-h-24" />
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-semibold text-foreground">Материал</label>
        <div className="flex gap-2">
          <button type="button" className={tabClass(kind === "file")} onClick={() => setKind("file")}>
            Файл оруулах
          </button>
          <button type="button" className={tabClass(kind === "link")} onClick={() => setKind("link")}>
            Холбоос
          </button>
        </div>

        {kind === "file" ? (
          <div className="space-y-3">
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const picked = e.target.files?.[0];
                if (picked) handleFile(picked);
              }}
            />
            {file && (
              <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm">
                <span className="font-semibold text-primary mr-2">
                  {TRAINING_FILE_TYPES[file.fileExt as keyof typeof TRAINING_FILE_TYPES]?.label ??
                    file.fileExt.toUpperCase()}
                </span>
                <span className="text-foreground break-all">{file.fileName || "Файл"}</span>
                {file.fileSize > 0 && (
                  <span className="text-muted-foreground ml-2">{formatFileSize(file.fileSize)}</span>
                )}
              </div>
            )}
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
              className="px-4 h-10 rounded-md border border-primary text-primary text-sm font-semibold hover:bg-primary/10 disabled:opacity-50"
            >
              {uploading
                ? `Оруулж байна... ${progress}%`
                : file
                  ? "Өөр файл сонгох"
                  : "Компьютерээс файл сонгох"}
            </button>
            <p className="text-xs text-muted-foreground">
              PDF, Word, PowerPoint, Excel · {TRAINING_MAX_MB}MB хүртэл
            </p>
          </div>
        ) : (
          <Input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://..."
            type="url"
          />
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting || uploading}
        className="px-6 h-10 rounded-md bg-primary text-primary-foreground font-semibold disabled:opacity-50"
      >
        {submitting ? "Хадгалж байна..." : "Хадгалах"}
      </button>
    </form>
  );
}
