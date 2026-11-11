"use client";

import { useRouter } from "next/navigation";
import { NewsForm } from "@/components/news-form";

export default function NewNewsPage() {
  const router = useRouter();

  async function create(values: Record<string, unknown>) {
    const res = await fetch("/api/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) return (await res.json().catch(() => null))?.error ?? "Алдаа гарлаа";
    router.push("/admin/news");
    return null;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Шинэ мэдээ</h1>
      <p className="text-sm text-muted-foreground">
        Илгээсний дараа хянагчийн зөвшөөрлийг хүлээж &quot;Хяналтад&quot; төлөвт орно.
      </p>
      <NewsForm submitLabel="Илгээх" busyLabel="Илгээж байна..." onSubmit={create} />
    </div>
  );
}
