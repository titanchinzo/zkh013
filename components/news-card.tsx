import Link from "next/link";
import Image from "next/image";
import { Images, Play } from "lucide-react";
import logo from "@/public/logo.png";
import { canOptimizeImage } from "@/lib/images";
import { formatShortDate, type NewsSummary } from "@/lib/news";
import { cn } from "@/lib/utils";

type ThumbProps = {
  item: NewsSummary;
  sizes: string;
  className?: string;
  preload?: boolean;
  badges?: boolean;
};

/** Мэдээний зураг: видео/цомгийн тэмдэгтэй, зураггүй бол ангийн лого. Байрлалыг (relative/absolute) className-ээр өгнө */
function NewsThumb({ item, sizes, className, preload, badges = true }: ThumbProps) {
  return (
    <div className={cn("overflow-hidden bg-muted", className)}>
      {item.cover ? (
        <Image
          src={item.cover}
          alt={item.title}
          fill
          sizes={sizes}
          preload={preload}
          unoptimized={!canOptimizeImage(item.cover)}
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center tactical-grid">
          <Image src={logo} alt="" sizes="120px" className="h-1/2 w-auto opacity-25" />
        </div>
      )}
      {badges && item.media?.kind === "video" && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white ring-2 ring-white/70 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <Play className="h-5 w-5 translate-x-0.5" fill="currentColor" />
          </span>
        </span>
      )}
      {badges && item.photoCount > 0 && (
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
          <Images className="h-3.5 w-3.5" />
          {item.photoCount}
        </span>
      )}
    </div>
  );
}

/** Энгийн мэдээний карт (grid-д) */
export function NewsCard({ item, excerpt = true }: { item: NewsSummary; excerpt?: boolean }) {
  return (
    <Link
      href={`/news/${item.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card metallic transition-colors hover:border-primary/60"
    >
      <NewsThumb
        item={item}
        className="relative aspect-video"
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
      />
      <div className="flex flex-1 flex-col p-5">
        <time dateTime={item.createdAt.toISOString()} className="text-xs font-medium text-primary">
          {formatShortDate(item.createdAt)}
        </time>
        <h3 className="mt-2 text-lg font-bold leading-snug text-foreground line-clamp-2 group-hover:text-primary transition-colors">
          {item.title}
        </h3>
        {excerpt && <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-3">{item.excerpt}</p>}
      </div>
    </Link>
  );
}

/** Онцлох (хамгийн сүүлийн) мэдээ — том зураг дээр гарчигтай */
export function NewsLeadCard({ item }: { item: NewsSummary }) {
  return (
    <Link
      href={`/news/${item.id}`}
      className="group relative block h-full min-h-[320px] sm:min-h-[440px] overflow-hidden rounded-xl border border-border"
    >
      <NewsThumb item={item} className="absolute inset-0" sizes="(max-width: 1024px) 100vw, 760px" preload />
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black via-black/55 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
        <span className="inline-block bg-primary px-2 py-0.5 text-xs font-bold tracking-widest text-primary-foreground">
          ОНЦЛОХ
        </span>
        <h2 className="mt-3 text-2xl md:text-4xl font-bold leading-tight text-white text-balance group-hover:text-primary transition-colors">
          {item.title}
        </h2>
        <p className="mt-3 max-w-2xl text-gray-200 line-clamp-2">{item.excerpt}</p>
        <time dateTime={item.createdAt.toISOString()} className="mt-3 block text-sm text-gray-300">
          {formatShortDate(item.createdAt)}
        </time>
      </div>
    </Link>
  );
}

/** Жижиг карт (хажуугийн "Сүүлийн мэдээ" жагсаалтад) */
export function NewsCompactCard({ item }: { item: NewsSummary }) {
  return (
    <Link href={`/news/${item.id}`} className="group flex gap-3">
      <NewsThumb item={item} className="relative aspect-video w-28 shrink-0 rounded-md" sizes="112px" badges={false} />
      <div className="min-w-0">
        <h3 className="text-sm font-semibold leading-snug text-foreground line-clamp-3 group-hover:text-primary transition-colors">
          {item.title}
        </h3>
        <time dateTime={item.createdAt.toISOString()} className="mt-1 block text-xs text-muted-foreground">
          {formatShortDate(item.createdAt)}
        </time>
      </div>
    </Link>
  );
}

/* ---------- Монгол бичгийн (MGL) горим: гарчиг, тайлбар босоо, баганууд зүүнээс баруун тийш ---------- */

/** Энгийн мэдээний карт — зураг дээр, доор нь огноо, гарчиг, тайлбар босоо */
export function NewsCardMgl({ item, excerpt = true }: { item: NewsSummary; excerpt?: boolean }) {
  return (
    <Link
      href={`/news/${item.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card metallic transition-colors hover:border-primary/60"
    >
      <NewsThumb
        item={item}
        className="relative aspect-video"
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
      />
      <div className={cn("flex flex-row gap-3 p-4", excerpt ? "h-64" : "h-52")}>
        <time dateTime={item.createdAt.toISOString()} className="mgl-v shrink-0 text-xs text-primary">
          {formatShortDate(item.createdAt)}
        </time>
        <h3 className="mgl-v line-clamp-4 shrink-0 text-lg leading-snug text-foreground transition-colors group-hover:text-primary">
          {item.title}
        </h3>
        {excerpt && (
          <p className="mgl-v line-clamp-4 min-w-0 text-sm leading-relaxed text-muted-foreground">{item.excerpt}</p>
        )}
      </div>
    </Link>
  );
}

/** Онцлох мэдээ — том зураг, зүүн талд нь босоо гарчиг */
export function NewsLeadCardMgl({ item, label }: { item: NewsSummary; label: string }) {
  return (
    <Link
      href={`/news/${item.id}`}
      className="group relative block h-full min-h-[360px] sm:min-h-[460px] overflow-hidden rounded-xl border border-border"
    >
      <NewsThumb item={item} className="absolute inset-0" sizes="(max-width: 1024px) 100vw, 760px" preload />
      <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-black via-black/60 to-transparent" />
      <div className="absolute inset-y-0 left-0 flex max-w-[78%] flex-row gap-4 overflow-hidden p-6 md:p-8">
        <span className="mgl-v shrink-0 self-start bg-primary px-1 py-2 text-xs text-primary-foreground">{label}</span>
        <h2 className="mgl-v line-clamp-4 shrink-0 text-2xl leading-snug text-white transition-colors group-hover:text-primary md:text-4xl">
          {item.title}
        </h2>
        <p className="mgl-v line-clamp-4 min-w-0 text-base leading-relaxed text-gray-200">{item.excerpt}</p>
        <time dateTime={item.createdAt.toISOString()} className="mgl-v shrink-0 text-sm text-gray-300">
          {formatShortDate(item.createdAt)}
        </time>
      </div>
    </Link>
  );
}

/** Жижиг карт (хажуугийн жагсаалтад) — зураг, хажууд нь босоо гарчиг */
export function NewsCompactCardMgl({ item }: { item: NewsSummary }) {
  return (
    <Link href={`/news/${item.id}`} className="group flex h-32 gap-3">
      <NewsThumb item={item} className="relative aspect-video w-28 shrink-0 self-start rounded-md" sizes="112px" badges={false} />
      <h3 className="mgl-v line-clamp-3 min-w-0 text-sm leading-snug text-foreground transition-colors group-hover:text-primary">
        {item.title}
      </h3>
    </Link>
  );
}
