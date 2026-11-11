"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ArrowLeft, Images, PenSquare, Play } from "lucide-react";
import { NewsForm, type NewsFormInitial } from "@/components/news-form";
import { NewsGallery } from "@/components/news-gallery";
import { NewsMediaEmbed } from "@/components/news-media";
import { NewsVideo } from "@/components/news-video";
import { canOptimizeImage, isStoredFileUrl, isUsableImageUrl } from "@/lib/images";
import { parseMediaUrl } from "@/lib/media";
import { formatDateTime } from "@/lib/hr";

// Утсан дээрх аппын «Мэдээ»: сайтын нийтлэгдсэн мэдээ. Эрхээс хамаарч хянагч хяналт хүлээж буй мэдээг
// зөвшөөрч/буцааж, нийтлэгч мэдээ бичиж хянуулахаар илгээнэ — сайтын /api/news-ээр (утсаар нь танина).

type Status = "pending" | "published" | "rejected";
type Summary = {
  id: string;
  title: string;
  excerpt: string;
  cover: string | null;
  photoCount: number;
  videoCount: number;
  hasMedia: boolean;
  createdAt: string;
  status?: Status;
  authorName?: string;
};
type ListData = {
  canWrite: boolean;
  canReview: boolean;
  published: Summary[];
  more: boolean;
  pending: Summary[];
  mine: Summary[];
};
type Article = NewsFormInitial & {
  _id: string;
  title: string;
  excerpt: string;
  content: string;
  status: Status;
  authorName?: string;
  createdAt: string;
};
type Viewer = { canReview: boolean; canEdit: boolean };

const STATUS: Record<Status, { label: string; className: string }> = {
  pending: { label: "Хяналтад", className: "bg-yellow-400/15 text-yellow-300" },
  published: { label: "Нийтлэгдсэн", className: "bg-green-500/15 text-green-300" },
  rejected: { label: "Буцаасан", className: "bg-red-500/15 text-red-300" },
};
const button = "h-11 rounded-md font-semibold disabled:opacity-50";
const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

function StatusChip({ status }: { status: Status }) {
  return <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${STATUS[status].className}`}>{STATUS[status].label}</span>;
}

function Cover({ src, className, sizes }: { src: string; className: string; sizes: string }) {
  return (
    <div className={`relative overflow-hidden bg-muted ${className}`}>
      <Image src={src} alt="" fill sizes={sizes} unoptimized={!canOptimizeImage(src)} className="object-cover" />
    </div>
  );
}

/** Мэдээний жагсаалт; version өөрчлөгдөхөд (бичсэн, хянасны дараа) дахин ачаална */
export function NewsList({
  version,
  notice,
  onOpen,
  onWrite,
}: {
  version: number;
  notice: string;
  onOpen: (id: string) => void;
  onWrite: () => void;
}) {
  const [data, setData] = useState<ListData | null>(null);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/app/news", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) {
      setError("Мэдээ ачаалж чадсангүй");
      return;
    }
    setError("");
    setData(await res.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- (re)load when opened or after a change
    load();
  }, [load, version]);

  async function more() {
    if (!data?.published.length) return;
    setLoadingMore(true);
    const last = data.published[data.published.length - 1];
    const res = await fetch(`/api/app/news?before=${encodeURIComponent(last.createdAt)}`, { cache: "no-store" }).catch(() => null);
    setLoadingMore(false);
    if (!res?.ok) return;
    const next: ListData = await res.json();
    setData({ ...data, published: [...data.published, ...next.published], more: next.more });
  }

  if (!data) return <p className="text-sm text-muted-foreground">{error || "Ачааллаж байна..."}</p>;

  return (
    <div className="space-y-6">
      {notice && <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{notice}</p>}

      {data.canWrite && (
        <button onClick={onWrite} className={`${button} flex w-full items-center justify-center gap-2 bg-primary text-primary-foreground`}>
          <PenSquare className="size-4" aria-hidden />
          Мэдээ бичих
        </button>
      )}

      {data.canReview && data.pending.length > 0 && (
        <section className="space-y-2" aria-label="Хянах мэдээ">
          <h2 className="font-bold text-foreground">Хянах мэдээ ({data.pending.length})</h2>
          {data.pending.map((n) => (
            <NewsRow key={n.id} news={n} meta={`${n.authorName} · ${formatDateTime(n.createdAt)}`} onOpen={onOpen} />
          ))}
        </section>
      )}

      {data.canWrite && data.mine.length > 0 && (
        <details className="rounded-xl border border-border bg-card px-3 py-2">
          <summary className="cursor-pointer py-1 text-sm font-semibold text-foreground">Миний мэдээ ({data.mine.length})</summary>
          <div className="mt-2 space-y-2 pb-1">
            {data.mine.map((n) => (
              <NewsRow key={n.id} news={n} meta={formatDateTime(n.createdAt)} onOpen={onOpen} />
            ))}
          </div>
        </details>
      )}

      <section className="space-y-3" aria-label="Мэдээ">
        {(data.canWrite || data.pending.length > 0) && <h2 className="font-bold text-foreground">Мэдээ</h2>}
        {data.published.length === 0 && <p className="text-sm text-muted-foreground">Одоогоор мэдээ алга.</p>}
        {data.published.map((n) => (
          <button
            key={n.id}
            onClick={() => onOpen(n.id)}
            className="block w-full overflow-hidden rounded-xl border border-border bg-card text-left active:bg-muted"
          >
            {n.cover && <Cover src={n.cover} className="aspect-video w-full" sizes="(max-width: 448px) 100vw, 448px" />}
            <div className="space-y-1 p-3">
              <p className="font-bold leading-snug text-foreground">{n.title}</p>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                {formatDateTime(n.createdAt)}
                {n.photoCount > 0 && (
                  <span className="inline-flex items-center gap-0.5">
                    <Images className="size-3" aria-hidden />
                    {n.photoCount}
                  </span>
                )}
                {(n.videoCount > 0 || n.hasMedia) && <Play className="size-3" aria-label="Бичлэгтэй" />}
              </p>
              <p className="line-clamp-2 text-sm text-muted-foreground">{n.excerpt}</p>
            </div>
          </button>
        ))}
        {data.more && (
          <button onClick={more} disabled={loadingMore} className={`${button} w-full border border-border text-foreground`}>
            {loadingMore ? "Ачааллаж байна..." : "Цааш үзэх"}
          </button>
        )}
      </section>
    </div>
  );
}

function NewsRow({ news, meta, onOpen }: { news: Summary; meta: string; onOpen: (id: string) => void }) {
  return (
    <button
      onClick={() => onOpen(news.id)}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-2 text-left active:bg-muted"
    >
      {news.cover ? (
        <Cover src={news.cover} className="size-14 shrink-0 rounded-md" sizes="56px" />
      ) : (
        <span className="flex size-14 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <PenSquare className="size-5" aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{news.title}</span>
        <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          {news.status && <StatusChip status={news.status} />}
          <span className="truncate">{meta}</span>
        </span>
      </span>
    </button>
  );
}

/** Бүтэн дэлгэцийн цонх — буцах товчтой толгой, гүйдэг бие */
function Screen({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  useEffect(() => {
    // Арын хуудас гүйхгүй
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-label={title}>
      <header className="shrink-0 border-b border-border bg-background" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex max-w-md items-center gap-2 px-2 py-2">
          <button
            onClick={onBack}
            aria-label="Буцах"
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-foreground active:bg-muted"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          <p className="truncate font-semibold text-foreground">{title}</p>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto overscroll-contain" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto max-w-md space-y-4 px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

function Linkified({ text }: { text: string }) {
  return text.split(URL_PATTERN).map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline">
        {part}
      </a>
    ) : (
      part
    )
  );
}

/** Нэг мэдээ: хянагч нийтлэх/буцаах, зохиогч засах */
export function NewsDetail({
  id,
  onBack,
  onEdit,
  onChanged,
}: {
  id: string;
  onBack: () => void;
  onEdit: (id: string) => void;
  onChanged: (message: string) => void;
}) {
  const [news, setNews] = useState<Article | null>(null);
  const [viewer, setViewer] = useState<Viewer>({ canReview: false, canEdit: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/news/${id}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!live) return;
        if (!res.ok || !data?.news) setError(data?.error ?? "Мэдээ олдсонгүй");
        else {
          setNews(data.news);
          setViewer(data.viewer ?? { canReview: false, canEdit: false });
        }
      })
      .catch(() => live && setError("Сервертэй холбогдож чадсангүй"));
    return () => {
      live = false;
    };
  }, [id]);

  async function review(action: "approve" | "reject") {
    if (action === "reject" && !confirm("Энэ мэдээг буцаах уу? Зохиогч нь засаж дахин илгээж болно.")) return;
    setBusy(true);
    const res = await fetch(`/api/news/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError((await res?.json().catch(() => null))?.error ?? "Алдаа гарлаа");
      return;
    }
    onChanged(action === "approve" ? `«${news?.title}» мэдээг нийтэллээ.` : `«${news?.title}» мэдээг буцаалаа.`);
  }

  const media = parseMediaUrl(news?.mediaUrl);
  const cover = news && isUsableImageUrl(news.imageUrl) ? news.imageUrl : "";
  const videos = (news?.videos ?? []).filter((url) => isStoredFileUrl(url));
  const gallery = (news?.images ?? []).filter((url) => isUsableImageUrl(url) && url !== cover);

  return (
    <Screen title={news?.title ?? "Мэдээ"} onBack={onBack}>
      {!news ? (
        <p className="text-sm text-muted-foreground">{error || "Ачааллаж байна..."}</p>
      ) : (
        <article className="space-y-4">
          <div className="space-y-1">
            {news.status !== "published" && <StatusChip status={news.status} />}
            <h1 className="text-xl font-bold leading-snug text-foreground">{news.title}</h1>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(news.createdAt)}
              {news.authorName && ` · ${news.authorName}`}
            </p>
          </div>
          {media ? (
            <NewsMediaEmbed media={media} title={news.title} />
          ) : (
            cover && !videos.length && <Cover src={cover} className="aspect-video w-full rounded-md" sizes="(max-width: 448px) 100vw, 448px" />
          )}
          {videos.map((url, i) => (
            <NewsVideo key={url} src={url} title={news.title} poster={i === 0 && !media && cover ? cover : undefined} />
          ))}
          <p className="text-sm font-semibold text-foreground/90">{news.excerpt}</p>
          <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/85">
            <Linkified text={news.content} />
          </div>
          {gallery.length > 0 && <NewsGallery images={gallery} title={news.title} />}

          {error && <p className="text-sm text-red-400">{error}</p>}
          {viewer.canReview && news.status === "pending" && (
            <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
              <button onClick={() => review("reject")} disabled={busy} className={`${button} border border-red-400/40 text-red-400`}>
                Буцаах
              </button>
              <button onClick={() => review("approve")} disabled={busy} className={`${button} bg-primary text-primary-foreground`}>
                Нийтлэх
              </button>
            </div>
          )}
          {viewer.canEdit && (
            <button onClick={() => onEdit(id)} className={`${button} w-full border border-border text-foreground`}>
              Засах
            </button>
          )}
        </article>
      )}
    </Screen>
  );
}

/** Мэдээ бичих (id = null) эсвэл засах — илгээсний дараа хянагч зөвшөөрөхөд нийтлэгдэнэ */
export function NewsWrite({ id, onBack, onDone }: { id: string | null; onBack: () => void; onDone: (message: string) => void }) {
  const [initial, setInitial] = useState<NewsFormInitial | null>(id ? null : {});
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/news/${id}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => (data?.news ? setInitial(data.news) : setError(data?.error ?? "Мэдээ олдсонгүй")))
      .catch(() => setError("Сервертэй холбогдож чадсангүй"));
  }, [id]);

  async function submit(values: Record<string, unknown>) {
    const res = await fetch(id ? `/api/news/${id}` : "/api/news", {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    }).catch(() => null);
    if (!res?.ok) return (await res?.json().catch(() => null))?.error ?? "Сервертэй холбогдож чадсангүй";
    onDone(id ? "Мэдээг хадгаллаа." : "Мэдээг хянагчид илгээлээ. Зөвшөөрөгдвөл сайт болон аппад нийтлэгдэнэ.");
    return null;
  }

  return (
    <Screen title={id ? "Мэдээ засах" : "Мэдээ бичих"} onBack={onBack}>
      {!initial ? (
        <p className="text-sm text-muted-foreground">{error || "Ачааллаж байна..."}</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Хянагч зөвшөөрсний дараа unit013.mn сайт болон аппад нийтлэгдэнэ. Зураг, бичлэгээ утаснаасаа шууд оруулна.
          </p>
          <NewsForm initial={initial} submitLabel={id ? "Хадгалах" : "Хянуулахаар илгээх"} busyLabel="Илгээж байна..." onSubmit={submit} />
        </>
      )}
    </Screen>
  );
}
