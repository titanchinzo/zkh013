import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { NewsCard, NewsCardMgl } from "@/components/news-card";
import { MglHeading } from "@/components/mgl/mgl-heading";
import { getLatestNews, type NewsSummary } from "@/lib/news";
import { mglNewsSummaries } from "@/lib/mgl/news";
import { getTranslator } from "@/lib/mgl/server";

async function loadLatest(): Promise<NewsSummary[]> {
  try {
    return await getLatestNews(3);
  } catch (err) {
    // Мэдээ татаж чадахгүй бол нүүр хуудсыг унагахгүй, энэ хэсгийг л нууна
    console.error("[latest-news] мэдээ татаж чадсангүй:", err);
    return [];
  }
}

/** Нүүр хуудсын "Сүүлийн мэдээ" хэсэг */
export async function LatestNews() {
  const [items, { script, t }] = await Promise.all([loadLatest(), getTranslator()]);
  if (items.length === 0) return null;

  if (script === "mgl") {
    const mglItems = await mglNewsSummaries(items);
    return (
      <section id="news" className="py-20 md:py-28 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto flex flex-col gap-10 lg:flex-row">
            <div className="flex shrink-0 flex-row items-start gap-6 lg:flex-col">
              <MglHeading title={t("СҮҮЛИЙН МЭДЭЭ")} />
              <Link
                href="/news"
                className="mgl-v inline-flex items-center gap-2 rounded-md border border-primary px-2 py-4 text-sm text-primary hover:bg-primary/10"
              >
                {t("Бүх мэдээ")}
                <ArrowRight className="h-4 w-4 rotate-90" />
              </Link>
            </div>
            <div className="grid flex-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {mglItems.map((item) => (
                <NewsCardMgl key={item.id} item={item} />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="news" className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">СҮҮЛИЙН МЭДЭЭ</h2>
              <div className="mt-4 h-1 w-20 bg-primary" />
            </div>
            <Link
              href="/news"
              className="inline-flex items-center gap-2 self-start rounded-md border border-primary px-4 h-10 text-sm font-semibold text-primary hover:bg-primary/10 sm:self-auto"
            >
              Бүх мэдээ
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
