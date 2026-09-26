"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { upload } from "@vercel/blob/client";
import { Input } from "@/components/ui/input";
import { canOptimizeImage, isUsableImageUrl } from "@/lib/images";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_MB = 15;

type Props = {
  name: string;
  defaultValue?: string;
  // Upload явагдаж байх үед формыг илгээхээс сэргийлэхийн тулд эцэг компонентод мэдэгдэнэ
  onUploadingChange?: (uploading: boolean) => void;
};

export function ImageUploadField({ name, defaultValue = "", onUploadingChange }: Props) {
  const [url, setUrl] = useState(defaultValue);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  function setUploading(value: boolean) {
    setProgress(value ? 0 : null);
    onUploadingChange?.(value);
  }

  async function handleFile(file: File) {
    setError("");
    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      setError("Зөвхөн JPG, PNG, WEBP, GIF зураг оруулна уу");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Зургийн хэмжээ ${MAX_MB}MB-аас ихгүй байх ёстой`);
      return;
    }

    setUploading(true);
    try {
      const blob = await upload(`news/${Date.now()}.${ext}`, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        contentType: file.type,
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });
      setUrl(blob.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Зураг оруулахад алдаа гарлаа");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const uploading = progress !== null;
  const showPreview = isUsableImageUrl(url);

  return (
    <div className="space-y-3">
      <input
        ref={fileInput}
        type="file"
        accept={Object.keys(ALLOWED_TYPES).join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {showPreview && (
        <div className="relative aspect-video w-full overflow-hidden rounded-md border border-border bg-muted">
          <Image
            src={url}
            alt="Мэдээний зураг"
            fill
            sizes="(max-width: 672px) 100vw, 672px"
            loading="eager"
            unoptimized={!canOptimizeImage(url)}
            className="object-cover"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
          className="px-4 h-10 rounded-md border border-primary text-primary text-sm font-semibold hover:bg-primary/10 disabled:opacity-50"
        >
          {uploading
            ? `Оруулж байна... ${progress}%`
            : showPreview
              ? "Өөр зураг сонгох"
              : "Компьютерээс зураг сонгох"}
        </button>
        {showPreview && !uploading && (
          <button
            type="button"
            onClick={() => setUrl("")}
            className="px-4 h-10 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground"
          >
            Зураг хасах
          </button>
        )}
      </div>

      <Input
        name={name}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="эсвэл зургийн холбоос (https://...)"
        disabled={uploading}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
