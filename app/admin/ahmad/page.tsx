"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { NewsGallery } from "@/components/news-gallery";
import type { AhmadPostView } from "@/lib/ahmad";
import { formatDateTime } from "@/lib/hr";
import { usePolling } from "@/lib/use-polling";

const primaryButton = "px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50";
const smallButton = "px-3 h-9 rounded-md border border-border text-sm text-foreground disabled:opacity-50";
const dangerButton = "px-3 h-9 rounded-md border border-red-400/40 text-sm text-red-400 disabled:opacity-50";

/** Хянагч, админ: «Ахмад» хэсэгт ирсэн постыг зөвшөөрөх, буцаах, устгах */
export default function AhmadReviewPage() {
  const [data, setData] = useState<{ pending: AhmadPostView[]; published: AhmadPostView[] } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/ahmad", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) {
      setError((await res?.json().catch(() => null))?.error ?? "Ачаалж чадсангүй");
      return;
    }
    setData(await res.json());
    setError("");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);
  usePolling(load, 30_000);

  async function act(post: AhmadPostView, action: "approve" | "reject" | "delete") {
    if (action === "delete" && !confirm(`${post.authorName}-ийн постыг зурагтай нь устгах уу?`)) return;
    setBusy(post.id);
    const res =
      action === "delete"
        ? await fetch(`/api/ahmad/${post.id}`, { method: "DELETE" })
        : await fetch(`/api/ahmad/${post.id}/review`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
          });
    setBusy(null);
    if (!res.ok) setError((await res.json().catch(() => null))?.error ?? "Алдаа гарлаа");
    load();
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ахмадын пост</h1>
        <p className="text-sm text-muted-foreground mt-1">
          «Ахмад» эрхтэй хүмүүсийн илгээсэн түүхэн зураг, дурсамж. Зөвшөөрсөн нь сайтын{" "}
          <Link href="/ahmad" className="text-primary hover:underline">
            «Ахмад»
          </Link>{" "}
          хуудсанд нийтэд гарна. Цэргийн нууцад хамаарах зураг, мэдээлэл байвал буцаана. Эрхийг «Хэрэглэгч, эрх» хуудаснаас
          админ олгоно.
        </p>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}

      <section className="space-y-3">
        <h2 className="font-bold text-foreground">Хянах ({data?.pending.length ?? 0})</h2>
        {!data ? (
          <p className="text-sm text-muted-foreground">Ачааллаж байна...</p>
        ) : data.pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">Хянах пост алга.</p>
        ) : (
          data.pending.map((post) => (
            <PostItem key={post.id} post={post}>
              <button onClick={() => act(post, "approve")} disabled={busy === post.id} className={primaryButton}>
                Зөвшөөрөх
              </button>
              <button onClick={() => act(post, "reject")} disabled={busy === post.id} className={smallButton}>
                Буцаах
              </button>
              <button onClick={() => act(post, "delete")} disabled={busy === post.id} className={dangerButton}>
                Устгах
              </button>
            </PostItem>
          ))
        )}
      </section>

      {data && data.published.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-bold text-foreground">Сүүлд нийтлэгдсэн</h2>
          {data.published.map((post) => (
            <PostItem key={post.id} post={post}>
              <span className="text-sm text-muted-foreground">♥ {post.hearts}</span>
              <button onClick={() => act(post, "reject")} disabled={busy === post.id} className={smallButton}>
                Нийтлэлээс авах
              </button>
              <button onClick={() => act(post, "delete")} disabled={busy === post.id} className={dangerButton}>
                Устгах
              </button>
            </PostItem>
          ))}
        </section>
      )}
    </div>
  );
}

function PostItem({ post, children }: { post: AhmadPostView; children: React.ReactNode }) {
  return (
    <article className="space-y-3 rounded-xl border border-border bg-card p-4" aria-label={`${post.authorName} — пост`}>
      <div>
        <p className="font-semibold text-foreground">{post.authorName}</p>
        <p className="text-xs text-muted-foreground">
          {formatDateTime(post.publishedAt ?? post.createdAt)}
          {post.year && ` · ${post.year} оны зураг`}
        </p>
      </div>
      {post.text && <p className="whitespace-pre-line break-words text-sm text-foreground/90">{post.text}</p>}
      {post.images.length > 0 && <NewsGallery images={post.images} title={post.authorName} />}
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </article>
  );
}
