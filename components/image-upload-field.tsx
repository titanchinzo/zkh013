"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { canOptimizeImage, isUsableImageUrl } from "@/lib/images";
import { isFacebookUrl } from "@/lib/media";
import {
  imageFromFacebookLink,
  NEWS_IMAGE_ACCEPT,
  newsImageError,
  uploadNewsImage,
} from "@/lib/news-image-upload";

const LINK_DEBOUNCE_MS = 500;

type Props = {
  name: string;
  // Видеоны холбоосоос зургийг автоматаар бөглөх боломжтой байхаар утгыг эцэг компонент удирдана
  value: string;
  onChange: (url: string) => void;
  // Upload явагдаж байх үед формыг илгээхээс сэргийлэхийн тулд эцэг компонентод мэдэгдэнэ
  onUploadingChange?: (uploading: boolean) => void;
};

export function ImageUploadField({ name, value: url, onChange: setUrl, onUploadingChange }: Props) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [resolving, setResolving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const linkTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const linkRequest = useRef(0);

  function setUploading(value: boolean) {
    setProgress(value ? 0 : null);
    onUploadingChange?.(value);
  }

  async function handleFile(file: File) {
    const invalid = newsImageError(file);
    setError(invalid ?? "");
    if (invalid) return;

    setUploading(true);
    try {
      setUrl(await uploadNewsImage(file, setProgress));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Зураг оруулахад алдаа гарлаа");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  // Facebook зургийн/постын холбоос оруулбал жинхэнэ зургийг нь олж харуулна
  function handleLink(value: string) {
    setUrl(value);
    setError("");
    clearTimeout(linkTimer.current);
    const id = ++linkRequest.current;
    if (!isFacebookUrl(value.trim())) {
      if (resolving) {
        setResolving(false);
        onUploadingChange?.(false);
      }
      return;
    }

    setResolving(true);
    onUploadingChange?.(true);
    linkTimer.current = setTimeout(async () => {
      try {
        const image = await imageFromFacebookLink(value.trim());
        if (id === linkRequest.current) setUrl(image);
      } catch (err) {
        if (id === linkRequest.current) setError(err instanceof Error ? err.message : "Зургийг олж чадсангүй");
      } finally {
        if (id === linkRequest.current) {
          setResolving(false);
          onUploadingChange?.(false);
        }
      }
    }, LINK_DEBOUNCE_MS);
  }

  const uploading = progress !== null;
  const showPreview = isUsableImageUrl(url);

  return (
    <div className="space-y-3">
      <input
        ref={fileInput}
        type="file"
        accept={NEWS_IMAGE_ACCEPT}
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
        onChange={(e) => handleLink(e.target.value)}
        placeholder="эсвэл зургийн / Facebook зургийн холбоос (https://...)"
        disabled={uploading}
      />
      {resolving && <p className="text-sm text-muted-foreground">Facebook-ээс зургийг татаж байна...</p>}
      {!resolving && !error && isFacebookUrl(url) && (
        <p className="text-xs text-muted-foreground">
          Facebook-ийн холбоос — хадгалах үед зургийг нь автоматаар татаж хадгална.
        </p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
