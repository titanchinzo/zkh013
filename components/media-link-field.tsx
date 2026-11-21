"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { NewsMediaEmbed } from "@/components/news-media";
import { parseMediaUrl, type NewsMedia } from "@/lib/media";

type Props = {
  name: string;
  defaultValue?: string;
  // YouTube холбоос бол видеоны зургийг, бусад үед null-ийг дамжуулна (зургийн талбарыг автоматаар бөглөхөд)
  onThumbnailChange?: (thumbnailUrl: string | null) => void;
  cover?: string; // формын нүүр зураг — Instagram картын урьдчилан харахад
};

const DEBOUNCE_MS = 600;

export function MediaLinkField({ name, defaultValue = "", onThumbnailChange, cover }: Props) {
  const [value, setValue] = useState(defaultValue);
  const [preview, setPreview] = useState<NewsMedia | null>(() => parseMediaUrl(defaultValue));
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const requestId = useRef(0);

  function handleChange(next: string) {
    setValue(next);
    setError("");
    clearTimeout(timer.current);
    const id = ++requestId.current;

    if (!next.trim()) {
      setPreview(null);
      setChecking(false);
      onThumbnailChange?.(null);
      return;
    }

    setChecking(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/media/preview?url=${encodeURIComponent(next.trim())}`);
        const data = await res.json();
        if (id !== requestId.current) return; // хэрэглэгч энэ хооронд өөр холбоос оруулсан
        if (!res.ok) {
          setPreview(null);
          setError(data.error ?? "Холбоосыг шалгаж чадсангүй");
          return;
        }
        setPreview(data.media);
        onThumbnailChange?.(data.thumbnailUrl ?? null);
      } catch {
        if (id === requestId.current) setError("Холбоосыг шалгаж чадсангүй");
      } finally {
        if (id === requestId.current) setChecking(false);
      }
    }, DEBOUNCE_MS);
  }

  return (
    <div className="space-y-3">
      <Input
        name={name}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="YouTube, Facebook эсвэл Instagram-ийн холбоос"
        inputMode="url"
      />
      <p className="text-xs text-muted-foreground">
        YouTube, Facebook эсвэл Instagram-ийн видео, reel, постын холбоосыг хуулж оруулахад мэдээн дотор тухайн
        видео/пост гарч ирнэ. Зураг хоосон бол YouTube, Facebook-ийн зураг автоматаар нүүр зураг болно.
      </p>
      {checking && <p className="text-sm text-muted-foreground">Холбоосыг шалгаж байна...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {preview?.provider === "instagram" && !checking && (
        <p className="text-xs text-amber-400">
          Instagram нэвтрээгүй хүнд постоо ихэвчлэн харуулдаггүй тул мэдээнд «Instagram дээр үзэх» карт гарна
          (утсан дээр Instagram апп нээгдэнэ). Instagram-аас зураг автоматаар ордоггүй — картад гарах нүүр зургаа
          доор оруулна уу. Reel-ийг сайт дээрээ шууд тоглуулах бол бичлэгийн файлыг «Бичлэг» хэсэгт оруулна.
        </p>
      )}
      {preview && !checking && (
        <NewsMediaEmbed media={preview} title="Урьдчилан харах" cover={cover} />
      )}
    </div>
  );
}
