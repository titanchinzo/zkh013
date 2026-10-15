"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Star, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { canOptimizeImage, isUsableImageUrl, NEWS_MAX_IMAGES } from "@/lib/images";
import { isFacebookUrl } from "@/lib/media";
import {
  imageFromFacebookLink,
  NEWS_IMAGE_ACCEPT,
  newsImageError,
  uploadNewsImage,
} from "@/lib/news-image-upload";

type Props = {
  value: string[];
  // Олон файл дараалан оруулахад хамгийн сүүлийн утга дээр нэмэхийн тулд setState хэлбэрээр авна
  onChange: (update: (current: string[]) => string[]) => void;
  onUploadingChange?: (uploading: boolean) => void;
  coverUrl?: string;
  onSetCover?: (url: string) => void;
};

/** Мэдээний зургийн цомог: олон зургийг нэг дор сонгож оруулна */
export function GalleryUploadField({ value, onChange, onUploadingChange, coverUrl, onSetCover }: Props) {
  const [status, setStatus] = useState<{ done: number; total: number; percent: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [link, setLink] = useState("");
  const [addingLink, setAddingLink] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const remaining = NEWS_MAX_IMAGES - value.length;

  const append = (url: string) => onChange((current) => (current.includes(url) ? current : [...current, url]));

  // Зургийн шууд холбоос эсвэл Facebook зургийн/постын холбоосоор цомогт нэмнэ
  async function addLink() {
    const url = link.trim();
    if (!url) return;
    setErrors([]);
    if (remaining <= 0) {
      setErrors([`Нэг мэдээнд ${NEWS_MAX_IMAGES}-аас олон зураг оруулах боломжгүй`]);
      return;
    }
    if (isFacebookUrl(url)) {
      setAddingLink(true);
      onUploadingChange?.(true);
      try {
        append(await imageFromFacebookLink(url));
        setLink("");
      } catch (err) {
        setErrors([err instanceof Error ? err.message : "Зургийг олж чадсангүй"]);
      } finally {
        setAddingLink(false);
        onUploadingChange?.(false);
      }
    } else if (isUsableImageUrl(url)) {
      append(url);
      setLink("");
    } else {
      setErrors(["Зургийн эсвэл Facebook зургийн холбоос оруулна уу"]);
    }
  }

  async function handleFiles(fileList: FileList) {
    const files = Array.from(fileList);
    const problems: string[] = [];
    if (files.length > remaining) {
      problems.push(`Нэг мэдээнд ${NEWS_MAX_IMAGES}-аас олон зураг оруулах боломжгүй`);
      files.splice(remaining);
    }
    const valid = files.filter((file) => {
      const invalid = newsImageError(file);
      if (invalid) problems.push(`${file.name}: ${invalid}`);
      return !invalid;
    });

    setErrors(problems);
    if (valid.length === 0) return;

    onUploadingChange?.(true);
    // Нэг нэгээр нь оруулж, бүрийг нь дуусмагц цомогт нэмнэ
    for (const [i, file] of valid.entries()) {
      setStatus({ done: i, total: valid.length, percent: 0 });
      try {
        const url = await uploadNewsImage(file, (percent) => setStatus({ done: i, total: valid.length, percent }));
        append(url);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Зураг оруулахад алдаа гарлаа";
        setErrors((current) => [...current, `${file.name}: ${message}`]);
      }
    }
    setStatus(null);
    onUploadingChange?.(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInput}
        type="file"
        multiple
        accept={NEWS_IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
        }}
      />

      {value.length > 0 && (
        <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {value.map((url) => {
            const isCover = url === coverUrl;
            return (
              <li key={url} className="group relative aspect-[4/3] overflow-hidden rounded-md border border-border bg-muted">
                <Image
                  src={url}
                  alt="Цомгийн зураг"
                  fill
                  sizes="160px"
                  unoptimized={!canOptimizeImage(url)}
                  className="object-cover"
                />
                {isCover && (
                  <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                    НҮҮР
                  </span>
                )}
                <div className="absolute inset-x-1 bottom-1 flex justify-end gap-1">
                  {onSetCover && !isCover && (
                    <button
                      type="button"
                      onClick={() => onSetCover(url)}
                      title="Нүүр зураг болгох"
                      aria-label="Нүүр зураг болгох"
                      className="flex h-7 w-7 items-center justify-center rounded bg-black/70 text-white hover:text-primary"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onChange((current) => current.filter((item) => item !== url))}
                    title="Цомгоос хасах"
                    aria-label="Цомгоос хасах"
                    className="flex h-7 w-7 items-center justify-center rounded bg-black/70 text-white hover:text-red-400"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        disabled={status !== null || remaining <= 0}
        onClick={() => fileInput.current?.click()}
        className="inline-flex items-center gap-2 px-4 h-10 rounded-md border border-primary text-primary text-sm font-semibold hover:bg-primary/10 disabled:opacity-50"
      >
        <ImagePlus className="h-4 w-4" />
        {status
          ? `Оруулж байна... ${status.done + 1}/${status.total} (${status.percent}%)`
          : value.length > 0
            ? "Зураг нэмэх"
            : "Зургууд сонгох"}
      </button>
      <div className="flex gap-2">
        <Input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault(); // формыг илгээхгүй
              addLink();
            }
          }}
          placeholder="эсвэл Facebook зургийн / зургийн холбоос буулгах"
          disabled={addingLink}
        />
        <button
          type="button"
          onClick={addLink}
          disabled={addingLink || !link.trim()}
          className="shrink-0 px-4 h-10 rounded-md border border-border text-sm font-semibold text-foreground hover:border-primary hover:text-primary disabled:opacity-50"
        >
          {addingLink ? "Татаж байна..." : "Нэмэх"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Олон зургийг нэг дор сонгож болно ({value.length}/{NEWS_MAX_IMAGES}). Мэдээн дотор цомог хэлбэрээр
        харагдана.{onSetCover && " ☆ дарж нүүр зураг болгоно."}
      </p>
      {errors.map((message) => (
        <p key={message} className="text-sm text-red-400">
          {message}
        </p>
      ))}
    </div>
  );
}
