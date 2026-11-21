"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImagePlus, X } from "lucide-react";
import { Input, Textarea } from "@/components/ui/input";
import { AHMAD_LIMITS, AHMAD_YEAR_MIN } from "@/lib/ahmad";
import { todayUb } from "@/lib/hr";
import { NEWS_IMAGE_ACCEPT, newsImageError } from "@/lib/news-image-upload";
import { uploadFile } from "@/lib/upload-client";

type Photo = { key: string; url: string | null; preview: string; progress: number; error?: string };

/** «Ахмад» пост бичих: дурсамж, зураг авсан он, 10 хүртэл зураг. Илгээсний дараа хянагч зөвшөөрнө. */
export function AhmadComposer({ name }: { name: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [year, setYear] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const latestYear = Number(todayUb().slice(0, 4));

  async function addFiles(files: FileList | null) {
    setError("");
    const room = AHMAD_LIMITS.images - photos.length;
    const list = [...(files ?? [])].slice(0, Math.max(0, room));
    if ((files?.length ?? 0) > room) setError(`${AHMAD_LIMITS.images} хүртэл зураг хавсаргана`);
    for (const file of list) {
      const problem = newsImageError(file);
      if (problem) {
        setError(problem);
        continue;
      }
      const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
      const preview = URL.createObjectURL(file);
      setPhotos((current) => [...current, { key, url: null, preview, progress: 0 }]);
      uploadFile("ahmad-image", file, file.type, (progress) =>
        setPhotos((current) => current.map((p) => (p.key === key ? { ...p, progress } : p)))
      )
        .then((url) => setPhotos((current) => current.map((p) => (p.key === key ? { ...p, url, progress: 100 } : p))))
        .catch((err: unknown) =>
          setPhotos((current) =>
            current.map((p) => (p.key === key ? { ...p, error: err instanceof Error ? err.message : "Оруулж чадсангүй" } : p))
          )
        );
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  function removePhoto(key: string) {
    setPhotos((current) => {
      const gone = current.find((p) => p.key === key);
      if (gone) URL.revokeObjectURL(gone.preview);
      return current.filter((p) => p.key !== key);
    });
  }

  const uploading = photos.some((p) => !p.url && !p.error);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    const images = photos.filter((p) => p.url).map((p) => p.url!);
    if (!text.trim() && images.length === 0) {
      setError("Дурсамж бичих эсвэл зураг оруулна уу");
      return;
    }
    setSending(true);
    const res = await fetch("/api/ahmad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, year: year || undefined, images }),
    }).catch(() => null);
    setSending(false);
    if (!res?.ok) {
      setError((await res?.json().catch(() => null))?.error ?? "Илгээж чадсангүй");
      return;
    }
    photos.forEach((p) => URL.revokeObjectURL(p.preview));
    setText("");
    setYear("");
    setPhotos([]);
    setNotice("Илгээлээ. Хянагч зөвшөөрсний дараа бүгдэд харагдана.");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-card p-4" aria-label="Пост бичих">
      <p className="text-sm font-semibold text-foreground">{name}</p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={AHMAD_LIMITS.text}
        placeholder="Дурсамж, зургийн тайлбар — хэзээ, хаана, хэн хэн байсан…"
        className="min-h-28"
        aria-label="Дурсамж"
      />
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {photos.map((p) => (
            <div key={p.key} className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
              <Image src={p.preview} alt="" fill sizes="120px" unoptimized className="object-cover" />
              {!p.url && !p.error && (
                <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[11px] text-white">{p.progress}%</span>
              )}
              {p.error && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/70 p-1 text-center text-[11px] text-red-300">
                  {p.error}
                </span>
              )}
              <button
                type="button"
                onClick={() => removePhoto(p.key)}
                aria-label="Зургийг хасах"
                className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/70 text-white"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept={NEWS_IMAGE_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={photos.length >= AHMAD_LIMITS.images}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm text-foreground hover:border-primary disabled:opacity-50"
        >
          <ImagePlus className="size-4 text-primary" aria-hidden />
          Зураг ({photos.length}/{AHMAD_LIMITS.images})
        </button>
        <Input
          type="number"
          inputMode="numeric"
          min={AHMAD_YEAR_MIN}
          max={latestYear}
          value={year}
          onChange={(e) => setYear(e.target.value)}
          placeholder="Он (жишээ нь 1998)"
          aria-label="Зураг авсан он"
          className="h-10 w-44"
        />
        <button
          type="submit"
          disabled={sending || uploading}
          className="ml-auto h-10 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {sending ? "Илгээж байна..." : uploading ? "Зураг оруулж байна..." : "Нийтлэх"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Хянагч зөвшөөрсний дараа нийтэд харагдана. Цэргийн нууцад хамаарах зураг, мэдээлэл оруулахгүй.
      </p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {notice && <p className="text-sm text-primary">{notice}</p>}
    </form>
  );
}
