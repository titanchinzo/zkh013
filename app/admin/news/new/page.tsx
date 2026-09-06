"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Textarea } from "@/components/ui/input";

export default function NewNewsPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form)),
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
          <label className="block text-sm font-semibold text-foreground mb-2">Зургийн URL (заавал биш)</label>
          <Input name="imageUrl" placeholder="https://..." />
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">Агуулга</label>
          <Textarea name="content" required className="min-h-64" />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="px-6 h-10 rounded-md bg-primary text-primary-foreground font-semibold disabled:opacity-50"
        >
          {submitting ? "Илгээж байна..." : "Илгээх"}
        </button>
      </form>
    </div>
  );
}
