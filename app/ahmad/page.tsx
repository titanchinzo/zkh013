import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { MglHeading } from "@/components/mgl/mgl-heading";
import { MglBand } from "@/components/mgl/mgl-ornaments";
import { AhmadComposer } from "@/components/ahmad/composer";
import { AhmadPostCard, AhmadPostCardMgl } from "@/components/ahmad/post-card";
import { ahmadViewer, myUnpublishedPosts, publishedPosts } from "@/lib/ahmad-server";
import { toMgl } from "@/lib/mgl/convert";
import { getTranslator } from "@/lib/mgl/server";
import { mglDigits } from "@/lib/mgl/shared";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

const INTRO = "Ахмад дайчид, ахмад алба хаагчдын түүхэн зураг, дурсамж";

export const metadata: Metadata = {
  title: "Ахмад",
  description: `${SITE_NAME} — ${INTRO.toLowerCase()}`,
  alternates: { canonical: "/ahmad" },
};

function pageHref(page: number) {
  return page > 1 ? `/ahmad?page=${page}` : "/ahmad";
}

export default async function AhmadPage({ searchParams }: PageProps<"/ahmad">) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(typeof params.page === "string" ? params.page : "1", 10) || 1);
  const [viewer, { script, t }] = await Promise.all([ahmadViewer(), getTranslator()]);
  const { posts, totalPages } = await publishedPosts(page, viewer?.userId);
  const signedIn = Boolean(viewer);

  if (script === "mgl") {
    // Дурсамж, нэрийг монгол бичигт (кэштэй) хөрвүүлнэ
    const converted = await toMgl(posts.flatMap((p) => [p.text, p.authorName]));
    const shown = posts.map((p, i) => ({ ...p, text: converted[i * 2], authorName: converted[i * 2 + 1] }));
    return (
      <div className="min-h-screen bg-background flex flex-col md:pl-24">
        <Nav />
        <main className="flex-1 pt-24 md:pt-12 pb-20">
          <div className="container mx-auto px-4 max-w-6xl">
            <MglBand className="mb-10" />
            <header className="mb-10 flex flex-row flex-wrap items-start gap-8">
              <MglHeading as="h1" eyebrow={t(SITE_NAME)} title={t("АХМАД")} />
              <p className="mgl-v h-64 text-muted-foreground">{t("Ахмад дайчид, ахмад алба хаагчдын түүхэн зураг, дурсамж")}</p>
              {viewer?.canPost && <p className="mgl-v h-64 text-sm text-primary">{t("Пост бичих бол MN горимд шилжинэ үү.")}</p>}
            </header>
            {shown.length === 0 ? (
              <div className="flex flex-row rounded-xl border border-border bg-card p-10">
                <p className="mgl-v h-48 text-muted-foreground">{t("Одоогоор пост алга.")}</p>
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                {shown.map((post) => (
                  <AhmadPostCardMgl key={post.id} post={post} signedIn={signedIn} t={t} />
                ))}
              </div>
            )}
            {totalPages > 1 && (
              <nav className="mt-10 flex flex-row justify-center gap-4" aria-label="Хуудас">
                {page > 1 && (
                  <Link href={pageHref(page - 1)} className="mgl-v rounded-md border border-border px-2 py-3 text-sm text-foreground">
                    {t("Өмнөх")}
                  </Link>
                )}
                <span className="mgl-v px-2 py-3 text-sm text-muted-foreground">
                  {mglDigits(`${page} / ${totalPages}`)}
                </span>
                {page < totalPages && (
                  <Link href={pageHref(page + 1)} className="mgl-v rounded-md border border-border px-2 py-3 text-sm text-foreground">
                    {t("Дараах")}
                  </Link>
                )}
              </nav>
            )}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const mine = viewer?.canPost && page === 1 ? await myUnpublishedPosts(viewer.userId) : [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Nav />
      <main className="flex-1 pt-24 md:pt-28 pb-20">
        <div className="container mx-auto px-4 max-w-2xl">
          <header className="mb-8">
            <p className="text-xs sm:text-sm font-semibold tracking-widest text-primary">{SITE_NAME.toUpperCase()}</p>
            <h1 className="mt-2 text-4xl md:text-5xl font-bold tracking-tight text-foreground">АХМАД</h1>
            <div className="mt-4 h-1 w-20 bg-primary" />
            <p className="mt-4 text-muted-foreground">{INTRO}.</p>
          </header>

          <div className="space-y-6">
            {viewer?.canPost && page === 1 && <AhmadComposer name={viewer.name} />}
            {viewer && !viewer.canPost && page === 1 && (
              <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                Пост бичих «Ахмад» эрхийг сайтын админ олгоно.
              </p>
            )}

            {mine.length > 0 && (
              <section className="space-y-3" aria-label="Миний хянагдаж буй пост">
                <h2 className="text-sm font-semibold text-muted-foreground">Миний хянагдаж буй, буцаагдсан пост</h2>
                {mine.map((post) => (
                  <AhmadPostCard key={post.id} post={post} signedIn canDelete />
                ))}
              </section>
            )}

            {posts.length === 0 ? (
              <div className="rounded-xl border border-border bg-card py-16 text-center text-muted-foreground">
                Одоогоор пост алга.
              </div>
            ) : (
              posts.map((post) => (
                <AhmadPostCard key={post.id} post={post} signedIn={signedIn} canDelete={post.mine || Boolean(viewer?.canReview)} />
              ))
            )}

            {totalPages > 1 && (
              <nav className="flex items-center justify-center gap-4 pt-4 text-sm" aria-label="Хуудас">
                {page > 1 && (
                  <Link href={pageHref(page - 1)} className="rounded-md border border-border px-4 py-2 text-foreground hover:border-primary">
                    ← Өмнөх
                  </Link>
                )}
                <span className="text-muted-foreground">
                  {page} / {totalPages}
                </span>
                {page < totalPages && (
                  <Link href={pageHref(page + 1)} className="rounded-md border border-border px-4 py-2 text-foreground hover:border-primary">
                    Дараах →
                  </Link>
                )}
              </nav>
            )}
            {!viewer && (
              <p className="text-center text-xs text-muted-foreground">
                <Link href="/sign-in?redirect_url=/ahmad" className="text-primary hover:underline">
                  Нэвтэрч
                </Link>{" "}
                зүрх дарна. «Ахмад» эрхтэй бол пост бичнэ.
              </p>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
