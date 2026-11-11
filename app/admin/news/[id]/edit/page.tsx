"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { NewsForm, type NewsFormInitial } from "@/components/news-form";
import type { Role } from "@/lib/roles";

type NewsItem = NewsFormInitial & { status: string };

export default function EditNewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [item, setItem] = useState<NewsItem | null>(null);
  const [role, setRole] = useState<Role | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/news/${id}`)
      .then((r) => r.json())
      .then((data) => setItem(data.news));
    fetch("/api/me")
      .then((r) => r.json())
      .then((me) => setRole(me.role ?? null));
  }, [id]);

  async function save(values: Record<string, unknown>) {
    const res = await fetch(`/api/news/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) return (await res.json().catch(() => null))?.error ?? "Алдаа гарлаа";
    router.push("/admin/news");
    return null;
  }

  if (!item || role === undefined) return <p className="text-muted-foreground text-sm">Ачааллаж байна...</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Мэдээ засах</h1>
      <NewsForm initial={item} submitLabel="Хадгалах" busyLabel="Хадгалж байна..." onSubmit={save}>
        {role === "admin" ? (
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
        ) : (
          <p className="text-sm text-muted-foreground">Хадгалсны дараа мэдээ дахин хянагчийн хяналтад орно.</p>
        )}
      </NewsForm>
    </div>
  );
}
