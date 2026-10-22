"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Textarea } from "@/components/ui/input";
import { ImageUploadField } from "@/components/image-upload-field";
import { GalleryUploadField } from "@/components/gallery-upload-field";
import { MediaLinkField } from "@/components/media-link-field";
import { VideoUploadField } from "@/components/video-upload-field";
import { autoFillImage } from "@/lib/media";

export default function NewNewsPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...Object.fromEntries(form), images, videos }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Алдаа гарлаа");
      return;
    }
    router.push("/admin/news");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Шинэ мэдээ</h1>
      <p className="text-sm text-muted-foreground">
        Илгээсний дараа хянагчийн зөвшөөрлийг хүлээж &quot;Хяналтад&quot; төлөвт орно.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">Гарчиг</label>
          <Input name="title" required />
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">Товч тайлбар</label>
          <Input name="excerpt" required />
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">
            YouTube / Facebook холбоос (заавал биш)
          </label>
          <MediaLinkField
            name="mediaUrl"
            onThumbnailChange={(thumb) => setImageUrl((current) => autoFillImage(current, thumb))}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">Нүүр зураг (заавал биш)</label>
          <ImageUploadField
            name="imageUrl"
            value={imageUrl}
            onChange={setImageUrl}
            onUploadingChange={setCoverUploading}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">Зургийн цомог (заавал биш)</label>
          <GalleryUploadField
            value={images}
            onChange={setImages}
            onUploadingChange={setGalleryUploading}
            coverUrl={imageUrl}
            onSetCover={setImageUrl}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">Бичлэг (заавал биш)</label>
          <VideoUploadField
            value={videos}
            onChange={setVideos}
            onUploadingChange={setVideoUploading}
            wantsPoster={!imageUrl}
            onPosterUploaded={(url) => setImageUrl((current) => current || url)}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">Агуулга</label>
          <Textarea name="content" required className="min-h-64" />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting || coverUploading || galleryUploading || videoUploading}
          className="px-6 h-10 rounded-md bg-primary text-primary-foreground font-semibold disabled:opacity-50"
        >
          {submitting ? "Илгээж байна..." : "Илгээх"}
        </button>
      </form>
    </div>
  );
}
