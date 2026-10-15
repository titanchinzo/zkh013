"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Input, Textarea } from "@/components/ui/input";
import { ImageUploadField } from "@/components/image-upload-field";
import { GalleryUploadField } from "@/components/gallery-upload-field";
import { MediaLinkField } from "@/components/media-link-field";
import { autoFillImage } from "@/lib/media";

type NewsItem = {
  title: string;
  excerpt: string;
  content: string;
  imageUrl?: string;
  images?: string[];
  mediaUrl?: string;
  status: string;
};

export default function EditNewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [item, setItem] = useState<NewsItem | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/news/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setItem(data.news);
        setImageUrl(data.news?.imageUrl ?? "");
        setImages(data.news?.images ?? []);
      });
  }, [id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/news/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...Object.fromEntries(form), images }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Алдаа гарлаа");
      return;
    }
    router.push("/admin/news");
  }

  if (!item) return <p className="text-muted-foreground text-sm">Ачааллаж байна...</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Мэдээ засах</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">Гарчиг</label>
          <Input name="title" defaultValue={item.title} required />
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">Товч тайлбар</label>
          <Input name="excerpt" defaultValue={item.excerpt} required />
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">
            YouTube / Facebook холбоос (заавал биш)
          </label>
          <MediaLinkField
            name="mediaUrl"
            defaultValue={item.mediaUrl ?? ""}
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
          <label className="block text-sm font-semibold text-foreground mb-2">Агуулга</label>
          <Textarea name="content" defaultValue={item.content} required className="min-h-64" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">Төлөв</label>
          <select
            name="status"
            defaultValue={item.status}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
          >
            <option value="pending">Хяналтад</option>
            <option value="published">Нийтлэгдсэн</option>
            <option value="rejected">Татгалзсан</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting || coverUploading || galleryUploading}
          className="px-6 h-10 rounded-md bg-primary text-primary-foreground font-semibold disabled:opacity-50"
        >
          {submitting ? "Хадгалж байна..." : "Хадгалах"}
        </button>
      </form>
    </div>
  );
}
