import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronRight, Clock, Images } from "lucide-react";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { NewsMediaEmbed } from "@/components/news-media";
import { NewsGallery } from "@/components/news-gallery";
import { NewsCompactCard, NewsCompactCardMgl } from "@/components/news-card";
import { ShareButtons } from "@/components/share-buttons";
import { MglHeading } from "@/components/mgl/mgl-heading";
import { MglScroller } from "@/components/mgl/mgl-scroller";
import { canOptimizeImage } from "@/lib/images";
import { toMgl } from "@/lib/mgl/convert";
import { mglNewsSummaries } from "@/lib/mgl/news";
import { getTranslator, type Translate } from "@/lib/mgl/server";
import {
  formatLongDate,
  formatShortDate,
  getAdjacentNews,
  getLatestNews,
  getPublishedArticle,
  readingMinutes,
  type NewsArticle,
  type NewsSummary,
} from "@/lib/news";
import { SITE_NAME, SITE_OG_IMAGE } from "@/lib/site";

export const dynamic = "force-dynamic";

// Facebook зэрэгт хуваалцахад мэдээний гарчиг, зураг гарна
export async function generateMetadata({ params }: PageProps<"/news/[id]">): Promise<Metadata> {
  const { id } = await params;
  const news = await getPublishedArticle(id);
  if (!news) return { title: "Мэдээ олдсонгүй" };

  const image = news.cover ? { url: news.cover, alt: news.title } : SITE_OG_IMAGE;
  return {
    title: news.title,
    description: news.excerpt,
    alternates: { canonical: `/news/${news.id}` },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      locale: "mn_MN",
      url: `/news/${news.id}`,
      title: news.title,
      description: news.excerpt,
      publishedTime: news.createdAt.toISOString(),
      images: [image],
    },
    twitter: { card: "summary_large_image", title: news.title, description: news.excerpt, images: [image.url] },
  };
}

// Агуулга доторх холбоосыг дарж болохоор харуулна
const URL_PATTERN = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

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

export default async function NewsDetailPage({ params }: PageProps<"/news/[id]">) {
  const { id } = await params;
  const news = await getPublishedArticle(id);
  if (!news) notFound();

  const [latest, adjacent, { script, t }] = await Promise.all([
    getLatestNews(5, news.id),
    getAdjacentNews(news.createdAt),
    getTranslator(),
  ]);

  // Видео/пост хавсаргасан бол нүүр зургийн оронд түүнийг харуулна (зураг нь жагсаалт, нүүр хуудсанд гарна)
  const showCover = !news.media && Boolean(news.imageUrl);
  const gallery = showCover ? news.images.filter((url) => url !== news.imageUrl) : news.images;

  if (script === "mgl") {
    return <MglArticle news={news} latest={latest} adjacent={adjacent} gallery={gallery} showCover={showCover} t={t} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Nav />
      <main className="flex-1 pt-24 md:pt-28 pb-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <nav aria-label="Байршил" className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-primary">
              Нүүр
            </Link>
            <ChevronRight className="h-4 w-4 shrink-0" />
            <Link href="/news" className="hover:text-primary">
              Мэдээ
            </Link>
            <ChevronRight className="h-4 w-4 shrink-0" />
            <span className="truncate text-foreground/70">{news.title}</span>
          </nav>

          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
            <article className="min-w-0">
              <h1 className="text-3xl md:text-5xl font-bold leading-tight tracking-tight text-foreground text-balance">
                {news.title}
              </h1>

              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <time dateTime={news.createdAt.toISOString()}>{formatLongDate(news.createdAt)}</time>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary" />
                  {readingMinutes(news.content)} минут унших
                </span>
                {gallery.length > 0 && (
                  <a href="#gallery" className="inline-flex items-center gap-1.5 hover:text-primary">
                    <Images className="h-4 w-4 text-primary" />
                    {gallery.length} зураг
                  </a>
                )}
              </div>

              <p className="mt-6 border-l-4 border-primary pl-4 text-lg md:text-xl leading-relaxed text-foreground/90">
                {news.excerpt}
              </p>

              {news.media ? (
                <div className="mt-8">
                  <NewsMediaEmbed media={news.media} title={news.title} />
                </div>
              ) : (
                showCover && (
                  <div className="relative mt-8 aspect-video w-full overflow-hidden rounded-xl border border-border">
                    <Image
                      src={news.imageUrl}
                      alt={news.title}
                      fill
                      preload
                      sizes="(max-width: 1024px) 100vw, 800px"
                      unoptimized={!canOptimizeImage(news.imageUrl)}
                      className="object-cover"
                    />
                  </div>
                )
              )}

              <div className="mt-8 whitespace-pre-wrap text-base md:text-lg leading-relaxed text-foreground/85">
                <Linkified text={news.content} />
              </div>

              {gallery.length > 0 && (
                <section id="gallery" className="mt-12 scroll-mt-24">
                  <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-foreground">
                    <Images className="h-5 w-5 text-primary" />
                    Зургийн цомог
                    <span className="text-base font-normal text-muted-foreground">({gallery.length})</span>
                  </h2>
                  <NewsGallery images={gallery} title={news.title} />
                </section>
              )}

              <div className="mt-12 border-y border-border py-5">
                <ShareButtons title={news.title} />
              </div>

              {(adjacent.older || adjacent.newer) && (
                <nav aria-label="Бусад мэдээ" className="mt-8 grid gap-4 sm:grid-cols-2">
                  {adjacent.older ? <AdjacentLink item={adjacent.older} direction="older" /> : <span />}
                  {adjacent.newer && <AdjacentLink item={adjacent.newer} direction="newer" />}
                </nav>
              )}
            </article>

            {latest.length > 0 && (
              <aside className="lg:sticky lg:top-24 lg:self-start">
                <h2 className="text-sm font-bold tracking-widest text-foreground">СҮҮЛИЙН МЭДЭЭ</h2>
                <div className="mt-2 mb-5 h-0.5 w-12 bg-primary" />
                <div className="space-y-5">
                  {latest.map((item) => (
                    <NewsCompactCard key={item.id} item={item} />
                  ))}
                </div>
                <Link
                  href="/news"
                  className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                >
                  Бүх мэдээ
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </aside>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function AdjacentLink({ item, direction }: { item: NewsSummary; direction: "older" | "newer" }) {
  const older = direction === "older";
  return (
    <Link
      href={`/news/${item.id}`}
      className={`group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/60 ${
        older ? "" : "sm:text-right"
      }`}
    >
      <span
        className={`flex items-center gap-1 text-xs font-semibold tracking-wider text-primary ${
          older ? "" : "sm:justify-end"
        }`}
      >
        {older && <ArrowLeft className="h-3.5 w-3.5" />}
        {older ? "ӨМНӨХ МЭДЭЭ" : "ДАРААГИЙН МЭДЭЭ"}
        {!older && <ArrowRight className="h-3.5 w-3.5" />}
      </span>
      <span className="mt-2 block font-semibold leading-snug text-foreground line-clamp-2 group-hover:text-primary">
        {item.title}
      </span>
    </Link>
  );
}

/* ---------- Монгол бичгийн (MGL) горим: гарчиг, агуулга босоо, хэвтээ гүйлгэнэ ---------- */

async function MglArticle({
  news,
  latest,
  adjacent,
  gallery,
  showCover,
  t,
}: {
  news: NewsArticle;
  latest: NewsSummary[];
  adjacent: { older: NewsSummary | null; newer: NewsSummary | null };
  gallery: string[];
  showCover: boolean;
  t: Translate;
}) {
  const neighbours = [adjacent.older, adjacent.newer].filter((item): item is NewsSummary => Boolean(item));
  const [[title, excerpt, content], mglLatest, mglNeighbours] = await Promise.all([
    toMgl([news.title, news.excerpt, news.content]),
    mglNewsSummaries(latest),
    mglNewsSummaries(neighbours),
  ]);
  const older = adjacent.older ? mglNeighbours[0] : null;
  const newer = adjacent.newer ? mglNeighbours[adjacent.older ? 1 : 0] : null;
  const paragraphs = content.split("\n").filter((line) => line.trim());

  return (
    <div className="min-h-screen bg-background flex flex-col md:pl-24">
      <Nav />
      <main className="flex-1 pt-24 md:pt-12 pb-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <Link
            href="/news"
            className="mb-6 inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="mgl-v">{t("Мэдээ")}</span>
          </Link>

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_260px]">
            <article className="min-w-0">
              <MglScroller label={title} className="flex h-[78vh] min-h-[480px] flex-row gap-7 pb-4">
                <h1 className="mgl-v shrink-0 text-3xl leading-snug text-foreground md:text-4xl">{title}</h1>
                <div className="flex shrink-0 flex-row gap-3 text-sm text-muted-foreground">
                  <time dateTime={news.createdAt.toISOString()} className="mgl-v inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    {formatShortDate(news.createdAt)}
                  </time>
                  <span className="mgl-v inline-flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    {readingMinutes(news.content)} {t("минут унших")}
                  </span>
                  {gallery.length > 0 && (
                    <a href="#gallery" className="mgl-v inline-flex items-center gap-2 hover:text-primary">
                      <Images className="h-4 w-4 text-primary" />
                      {gallery.length} {t("зураг")}
                    </a>
                  )}
                </div>
                <p className="mgl-v shrink-0 border-l-4 border-primary pl-3 text-xl leading-relaxed text-foreground/90">
                  {excerpt}
                </p>
                {news.media ? (
                  <div className="w-[min(40rem,78vw)] shrink-0 self-center">
                    <NewsMediaEmbed media={news.media} title={news.title} />
                  </div>
                ) : (
                  showCover && (
                    <div className="relative aspect-video w-[min(40rem,78vw)] shrink-0 self-center overflow-hidden rounded-xl border border-border">
                      <Image
                        src={news.imageUrl}
                        alt={news.title}
                        fill
                        preload
                        sizes="(max-width: 1024px) 78vw, 640px"
                        unoptimized={!canOptimizeImage(news.imageUrl)}
                        className="object-cover"
                      />
                    </div>
                  )
                )}
                {paragraphs.map((paragraph, i) => (
                  <p key={i} className="mgl-v shrink-0 text-lg leading-loose text-foreground/85">
                    <Linkified text={paragraph} />
                  </p>
                ))}
              </MglScroller>

              {gallery.length > 0 && (
                <section id="gallery" className="mt-10 flex scroll-mt-24 flex-row gap-5">
                  <h2 className="mgl-v inline-flex shrink-0 items-center gap-2 text-xl text-foreground">
                    <Images className="h-5 w-5 text-primary" />
                    {t("Зургийн цомог")}
                    <span className="text-base text-muted-foreground">({gallery.length})</span>
                  </h2>
                  <div className="min-w-0 flex-1">
                    <NewsGallery images={gallery} title={news.title} />
                  </div>
                </section>
              )}

              <div className="mt-10 border-y border-border py-5">
                <ShareButtons
                  title={news.title}
                  vertical
                  labels={{
                    share: t("Хуваалцах:"),
                    copy: t("Холбоос хуулах"),
                    copied: t("Хуулагдлаа"),
                    more: t("Бусад"),
                  }}
                />
              </div>

              {(older || newer) && (
                <nav aria-label="Бусад мэдээ" className="mt-8 grid gap-4 sm:grid-cols-2">
                  {older ? <AdjacentLinkMgl item={older} label={t("ӨМНӨХ МЭДЭЭ")} older /> : <span />}
                  {newer && <AdjacentLinkMgl item={newer} label={t("ДАРААГИЙН МЭДЭЭ")} />}
                </nav>
              )}
            </article>

            {mglLatest.length > 0 && (
              <aside className="flex flex-col gap-5 lg:sticky lg:top-10 lg:self-start">
                <MglHeading as="h2" title={t("СҮҮЛИЙН МЭДЭЭ")} />
                {mglLatest.map((item) => (
                  <NewsCompactCardMgl key={item.id} item={item} />
                ))}
                <Link
                  href="/news"
                  className="mgl-v inline-flex items-center gap-1 self-start text-sm text-primary hover:underline"
                >
                  {t("Бүх мэдээ")}
                  <ArrowRight className="h-4 w-4 rotate-90" />
                </Link>
              </aside>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function AdjacentLinkMgl({ item, label, older }: { item: NewsSummary; label: string; older?: boolean }) {
  return (
    <Link
      href={`/news/${item.id}`}
      className="group flex h-48 flex-row gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/60"
    >
      <span className="mgl-v inline-flex items-center gap-1 text-xs text-primary">
        {older ? <ArrowLeft className="h-3.5 w-3.5 rotate-90" /> : <ArrowRight className="h-3.5 w-3.5 rotate-90" />}
        {label}
      </span>
      <span className="mgl-v line-clamp-3 text-base leading-snug text-foreground group-hover:text-primary">{item.title}</span>
    </Link>
  );
}
