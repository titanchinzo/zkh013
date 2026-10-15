import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronRight, Clock, Images } from "lucide-react";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { NewsMediaEmbed } from "@/components/news-media";
import { NewsGallery } from "@/components/news-gallery";
import { NewsCompactCard } from "@/components/news-card";
import { ShareButtons } from "@/components/share-buttons";
import { canOptimizeImage } from "@/lib/images";
import {
  formatLongDate,
  getAdjacentNews,
  getLatestNews,
  getPublishedArticle,
  readingMinutes,
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

  const [latest, adjacent] = await Promise.all([getLatestNews(5, news.id), getAdjacentNews(news.createdAt)]);

  // Видео/пост хавсаргасан бол нүүр зургийн оронд түүнийг харуулна (зураг нь жагсаалт, нүүр хуудсанд гарна)
  const showCover = !news.media && Boolean(news.imageUrl);
  const gallery = showCover ? news.images.filter((url) => url !== news.imageUrl) : news.images;

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
