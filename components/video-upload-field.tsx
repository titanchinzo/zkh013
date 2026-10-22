"use client";

import { useRef, useState } from "react";
import { Film, X } from "lucide-react";
import { uploadNewsImage } from "@/lib/news-image-upload";
import { uploadFile } from "@/lib/upload-client";
import { NEWS_MAX_VIDEOS, NEWS_VIDEO_ACCEPT, NEWS_VIDEO_MAX_MB, NEWS_VIDEO_TYPES } from "@/lib/uploads";

type Props = {
  value: string[];
  // Олон файл дараалан оруулахад хамгийн сүүлийн утга дээр нэмэхийн тулд setState хэлбэрээр авна
  onChange: (update: (current: string[]) => string[]) => void;
  onUploadingChange?: (uploading: boolean) => void;
  // Мэдээнд нүүр зураг байхгүй бол бичлэгийн нэг кадрыг зураг болгож оруулаад хаягийг нь өгнө
  wantsPoster?: boolean;
  onPosterUploaded?: (url: string) => void;
};

const POSTER_TIMEOUT_MS = 15000;

/** Файлын MIME төрөл (зарим browser .mov-ийн төрлийг хоосон өгдөг тул өргөтгөлөөр нь) */
function videoTypeOf(file: File) {
  if (NEWS_VIDEO_TYPES[file.type]) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return Object.entries(NEWS_VIDEO_TYPES).find(([, value]) => value === ext)?.[0] ?? null;
}

function waitFor(video: HTMLVideoElement, event: "loadeddata" | "seeked") {
  return new Promise<void>((resolve, reject) => {
    video.addEventListener(event, () => resolve(), { once: true });
    video.addEventListener("error", () => reject(new Error("decode")), { once: true });
  });
}

/** Бичлэгийн эхэн хэсгийн нэг кадрыг JPEG зураг болгоно (browser тоглуулж чадахгүй формат бол null) */
async function capturePoster(file: File): Promise<File | null> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), POSTER_TIMEOUT_MS));
  const capture = async () => {
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    await waitFor(video, "loadeddata");
    // Эхний кадр ихэвчлэн хар байдаг тул 1 дэх секунд руу шилжинэ (үргэлжлэх хугацаа нь тодорхойгүй бол эхний кадрыг авна)
    if (Number.isFinite(video.duration) && video.duration > 0.5) {
      video.currentTime = Math.min(1, video.duration / 2);
      await waitFor(video, "seeked");
    }
    if (!video.videoWidth || !video.videoHeight) return null;
    const scale = Math.min(1, 1280 / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ? new File([blob], "poster.jpg", { type: "image/jpeg" }) : null;
  };
  try {
    return await Promise.race([capture(), timeout]);
  } catch {
    return null;
  } finally {
    video.removeAttribute("src");
    URL.revokeObjectURL(url);
  }
}

/** Мэдээний бичлэг (видео файл): серверт оруулж, мэдээн дотор сайт өөрөө тоглуулна */
export function VideoUploadField({ value, onChange, onUploadingChange, wantsPoster, onPosterUploaded }: Props) {
  const [status, setStatus] = useState<{ done: number; total: number; percent: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const remaining = NEWS_MAX_VIDEOS - value.length;

  async function handleFiles(fileList: FileList) {
    const files = Array.from(fileList);
    const problems: string[] = [];
    if (files.length > remaining) {
      problems.push(`Нэг мэдээнд ${NEWS_MAX_VIDEOS}-аас олон бичлэг оруулах боломжгүй`);
      files.splice(remaining);
    }
    const valid = files.filter((file) => {
      if (!videoTypeOf(file)) problems.push(`${file.name}: Зөвхөн MP4, WEBM, MOV бичлэг оруулна уу`);
      else if (file.size > NEWS_VIDEO_MAX_MB * 1024 * 1024) {
        problems.push(`${file.name}: Бичлэгийн хэмжээ ${NEWS_VIDEO_MAX_MB}MB-аас ихгүй байх ёстой`);
      } else return true;
      return false;
    });

    setErrors(problems);
    if (valid.length === 0) return;

    onUploadingChange?.(true);
    let needsPoster = Boolean(wantsPoster && onPosterUploaded);
    // Нэг нэгээр нь оруулж, бүрийг нь дуусмагц жагсаалтад нэмнэ
    for (const [i, file] of valid.entries()) {
      setStatus({ done: i, total: valid.length, percent: 0 });
      try {
        const url = await uploadFile("news-video", file, videoTypeOf(file)!, (percent) =>
          setStatus({ done: i, total: valid.length, percent })
        );
        onChange((current) => (current.includes(url) ? current : [...current, url]));
        if (needsPoster) {
          const poster = await capturePoster(file);
          if (poster) {
            onPosterUploaded!(await uploadNewsImage(poster));
            needsPoster = false;
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Бичлэг оруулахад алдаа гарлаа";
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
        accept={NEWS_VIDEO_ACCEPT}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
        }}
      />

      {value.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {value.map((url) => (
            <li key={url} className="relative overflow-hidden rounded-md border border-border bg-black">
              <video src={url} controls preload="metadata" playsInline className="aspect-video w-full" />
              <button
                type="button"
                onClick={() => onChange((current) => current.filter((item) => item !== url))}
                title="Бичлэгийг хасах"
                aria-label="Бичлэгийг хасах"
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded bg-black/70 text-white hover:text-red-400"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={status !== null || remaining <= 0}
        onClick={() => fileInput.current?.click()}
        className="inline-flex items-center gap-2 px-4 h-10 rounded-md border border-primary text-primary text-sm font-semibold hover:bg-primary/10 disabled:opacity-50"
      >
        <Film className="h-4 w-4" />
        {status
          ? `Оруулж байна... ${status.done + 1}/${status.total} (${status.percent}%)`
          : value.length > 0
            ? "Бичлэг нэмэх"
            : "Бичлэг сонгох"}
      </button>
      <p className="text-xs text-muted-foreground">
        MP4, WEBM, MOV · {NEWS_VIDEO_MAX_MB / 1024}GB хүртэл ({value.length}/{NEWS_MAX_VIDEOS}). Мэдээн дотор сайт
        өөрөө тоглуулна. Нүүр зураг хоосон бол бичлэгийн нэг кадр нүүр зураг болно.
      </p>
      {errors.map((message) => (
        <p key={message} className="text-sm text-red-400">
          {message}
        </p>
      ))}
    </div>
  );
}
