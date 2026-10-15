import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { NewsCard } from "@/components/news-card";
import { getLatestNews, type NewsSummary } from "@/lib/news";

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
  const items = await loadLatest();
  if (items.length === 0) return null;

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
