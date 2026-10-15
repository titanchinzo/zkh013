import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { Input } from "@/components/ui/input";
import { NewsCard, NewsLeadCard } from "@/components/news-card";
import { getPublishedNews } from "@/lib/news";
import { SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Мэдээ",
  description: `${SITE_NAME}-ийн үйл ажиллагаа, арга хэмжээний мэдээ мэдээлэл`,
  alternates: { canonical: "/news" },
};

// Нэг хуудсанд: онцлох 1 + хажуугийн 2 + grid-д 9
const PER_PAGE = 12;

function pageHref(page: number, q: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/news?${query}` : "/news";
}

export default async function NewsPage({ searchParams }: PageProps<"/news">) {
  const params = await searchParams;
  const q = (typeof params.q === "string" ? params.q : "").trim();
  const page = Math.max(1, Number.parseInt(typeof params.page === "string" ? params.page : "1", 10) || 1);
  const { items, total, totalPages } = await getPublishedNews({ q, page, perPage: PER_PAGE });

  // Эхний хуудсанд (хайлтгүй үед) хамгийн сүүлийн мэдээг онцолж харуулна
  const featured = !q && page === 1;
  const lead = featured ? items[0] : undefined;
  const side = featured ? items.slice(1, 3) : [];
  const rest = featured ? items.slice(3) : items;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Nav />
      <main className="flex-1 pt-24 md:pt-28 pb-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs sm:text-sm font-semibold tracking-widest text-primary">{SITE_NAME.toUpperCase()}</p>
              <h1 className="mt-2 text-4xl md:text-5xl font-bold tracking-tight text-foreground">МЭДЭЭ</h1>
              <div className="mt-4 h-1 w-20 bg-primary" />
            </div>
            <form action="/news" role="search" className="flex w-full gap-2 md:w-96">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  name="q"
                  type="search"
                  defaultValue={q}
                  placeholder="Мэдээ хайх..."
                  aria-label="Мэдээ хайх"
                  className="pl-9"
                />
              </div>
              <button
                type="submit"
                className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Хайх
              </button>
            </form>
          </header>

          {q && (
            <p className="mb-6 text-sm text-muted-foreground">
              &ldquo;<span className="text-foreground">{q}</span>&rdquo; хайлтаар {total} мэдээ олдлоо ·{" "}
              <Link href="/news" className="text-primary hover:underline">
                Бүх мэдээ
              </Link>
            </p>
          )}

          {items.length === 0 ? (
            <div className="rounded-xl border border-border bg-card py-20 text-center">
              <p className="text-muted-foreground">
                {q ? "Хайлтад тохирох мэдээ олдсонгүй." : page > 1 ? "Энэ хуудсанд мэдээ алга." : "Одоогоор мэдээ алга байна."}
              </p>
              {(q || page > 1) && (
                <Link href="/news" className="mt-4 inline-block text-sm text-primary hover:underline">
                  Бүх мэдээ рүү буцах
                </Link>
              )}
            </div>
          ) : (
            <>
              {lead && (
                <div className="mb-6 grid gap-6 lg:grid-cols-3">
                  <div className={side.length > 0 ? "lg:col-span-2" : "lg:col-span-3"}>
                    <NewsLeadCard item={lead} />
                  </div>
                  {side.length > 0 && (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
                      {side.map((item) => (
                        <NewsCard key={item.id} item={item} excerpt={false} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {rest.length > 0 && (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((item) => (
                    <NewsCard key={item.id} item={item} />
                  ))}
                </div>
              )}

              <Pagination page={page} totalPages={totalPages} q={q} />
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Pagination({ page, totalPages, q }: { page: number; totalPages: number; q: string }) {
  if (totalPages <= 1) return null;

  // 1 … 4 5 [6] 7 8 … 20
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2
  );
  const itemClass =
    "flex h-10 min-w-10 items-center justify-center rounded-md border border-border px-3 text-sm font-medium transition-colors";

  return (
    <nav aria-label="Хуудаслалт" className="mt-12 flex flex-wrap items-center justify-center gap-2">
      {page > 1 && (
        <Link href={pageHref(page - 1, q)} className={cn(itemClass, "hover:border-primary hover:text-primary")}>
          <ChevronLeft className="h-4 w-4" />
          <span className="ml-1 hidden sm:inline">Өмнөх</span>
        </Link>
      )}
      {pages.map((p, i) => (
        <span key={p} className="flex items-center gap-2">
          {i > 0 && p - pages[i - 1] > 1 && <span className="text-muted-foreground">…</span>}
          <Link
            href={pageHref(p, q)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              itemClass,
              p === page
                ? "border-primary bg-primary text-primary-foreground"
                : "text-foreground hover:border-primary hover:text-primary"
            )}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < totalPages && (
        <Link href={pageHref(page + 1, q)} className={cn(itemClass, "hover:border-primary hover:text-primary")}>
          <span className="mr-1 hidden sm:inline">Дараах</span>
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </nav>
  );
}
