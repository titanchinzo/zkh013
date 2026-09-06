"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type NewsItem = {
  _id: string;
  title: string;
  excerpt: string;
  status: "pending" | "published" | "rejected";
  authorName: string;
  createdAt: string;
};

const statusLabel: Record<NewsItem["status"], string> = {
  pending: "Хяналтад",
  published: "Нийтлэгдсэн",
  rejected: "Татгалзсан",
};

const statusColor: Record<NewsItem["status"], string> = {
  pending: "text-yellow-400",
  published: "text-primary",
  rejected: "text-red-400",
};

export default function AdminNewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [newsRes, meRes] = await Promise.all([fetch("/api/news?all=1"), fetch("/api/me")]);
    const data = await newsRes.json();
    const me = await meRes.json();
    setItems(data.news ?? []);
    setIsAdmin(me.role === "admin");
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  async function review(id: string, action: "approve" | "reject") {
    await fetch(`/api/news/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Устгах уу?")) return;
    await fetch(`/api/news/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Мэдээ</h1>
        <Link
          href="/admin/news/new"
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold"
        >
          + Шинэ мэдээ
        </Link>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Ачааллаж байна...</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm">Мэдээ алга байна.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item._id} className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-4">
              <div>
                <p className={`text-xs font-semibold uppercase mb-1 ${statusColor[item.status]}`}>
                  {statusLabel[item.status]}
                </p>
                <h2 className="font-bold text-foreground">{item.title}</h2>
                <p className="text-sm text-muted-foreground line-clamp-2">{item.excerpt}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {item.authorName} · {new Date(item.createdAt).toLocaleDateString("mn-MN")}
                </p>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                {item.status === "pending" && (
                  <>
                    <button
                      onClick={() => review(item._id, "approve")}
                      className="px-3 py-1.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground"
                    >
                      Зөвшөөрөх
                    </button>
                    <button
                      onClick={() => review(item._id, "reject")}
                      className="px-3 py-1.5 text-xs font-semibold rounded-md border border-border text-muted-foreground"
                    >
                      Татгалзах
                    </button>
                  </>
                )}
                {isAdmin && (
                  <>
                    <Link
                      href={`/admin/news/${item._id}/edit`}
                      className="px-3 py-1.5 text-xs font-semibold rounded-md border border-border text-center text-foreground"
                    >
                      Засах
                    </Link>
                    <button
                      onClick={() => remove(item._id)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-md border border-red-400/40 text-red-400"
                    >
                      Устгах
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
