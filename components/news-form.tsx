"use client";

import { useState } from "react";
import { Input, Textarea } from "@/components/ui/input";
import { ImageUploadField } from "@/components/image-upload-field";
import { GalleryUploadField } from "@/components/gallery-upload-field";
import { MediaLinkField } from "@/components/media-link-field";
import { VideoUploadField } from "@/components/video-upload-field";
import { autoFillImage } from "@/lib/media";

export type NewsFormInitial = {
  title?: string;
  excerpt?: string;
  content?: string;
  mediaUrl?: string;
  imageUrl?: string;
  images?: string[];
  videos?: string[];
};

const label = "block text-sm font-semibold text-foreground mb-2";

/**
 * Мэдээ бичих, засах маягт — админы хуудас болон утсан дээрх апп хоёулаа ашиглана. Зураг, бичлэгийг утаснаас ч
 * оруулна (хэсэгчлэн, сүлжээ тасарвал үргэлжилнэ). onSubmit алдаа гарвал алдааны текст, амжилттай бол null буцаана.
 * children — илгээх товчны өмнөх нэмэлт талбар (админы «Төлөв» г.м).
 */
export function NewsForm({
  initial = {},
  submitLabel,
  busyLabel,
  onSubmit,
  children,
}: {
  initial?: NewsFormInitial;
  submitLabel: string;
  busyLabel: string;
  onSubmit: (values: Record<string, unknown>) => Promise<string | null>;
  children?: React.ReactNode;
}) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState(initial.imageUrl ?? "");
  const [images, setImages] = useState<string[]>(initial.images ?? []);
  const [videos, setVideos] = useState<string[]>(initial.videos ?? []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const message = await onSubmit({ ...Object.fromEntries(form), images, videos });
    setSubmitting(false);
    if (message) setError(message);
  }

  const uploading = coverUploading || galleryUploading || videoUploading;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={label}>Гарчиг</label>
        <Input name="title" defaultValue={initial.title} required />
      </div>
      <div>
        <label className={label}>Товч тайлбар</label>
        <Input name="excerpt" defaultValue={initial.excerpt} required />
      </div>
      <div>
        <label className={label}>YouTube / Facebook холбоос (заавал биш)</label>
        <MediaLinkField
          name="mediaUrl"
          defaultValue={initial.mediaUrl ?? ""}
          onThumbnailChange={(thumb) => setImageUrl((current) => autoFillImage(current, thumb))}
        />
      </div>
      <div>
        <label className={label}>Нүүр зураг (заавал биш)</label>
        <ImageUploadField name="imageUrl" value={imageUrl} onChange={setImageUrl} onUploadingChange={setCoverUploading} />
      </div>
      <div>
        <label className={label}>Зургийн цомог (заавал биш)</label>
        <GalleryUploadField
          value={images}
          onChange={setImages}
          onUploadingChange={setGalleryUploading}
          coverUrl={imageUrl}
          onSetCover={setImageUrl}
        />
      </div>
      <div>
        <label className={label}>Бичлэг (заавал биш)</label>
        <VideoUploadField
          value={videos}
          onChange={setVideos}
          onUploadingChange={setVideoUploading}
          wantsPoster={!imageUrl}
          onPosterUploaded={(url) => setImageUrl((current) => current || url)}
        />
      </div>
      <div>
        <label className={label}>Агуулга</label>
        <Textarea name="content" defaultValue={initial.content} required className="min-h-64" />
      </div>
      {children}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting || uploading}
        className="px-6 h-10 rounded-md bg-primary text-primary-foreground font-semibold disabled:opacity-50"
      >
        {submitting ? busyLabel : uploading ? "Файл оруулж байна..." : submitLabel}
      </button>
    </form>
  );
}
