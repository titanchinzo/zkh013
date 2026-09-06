import { notFound } from "next/navigation";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { connectToDatabase } from "@/lib/mongodb";
import News from "@/lib/models/News";

export const dynamic = "force-dynamic";

type NewsDoc = {
  title: string;
  content: string;
  status: string;
  createdAt: string;
};

export default async function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connectToDatabase();

  let news: NewsDoc | null = null;
  try {
    news = (await News.findById(id).lean()) as unknown as NewsDoc | null;
  } catch {
    news = null;
  }

  if (!news || news.status !== "published") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Nav />
      <main className="flex-1 pt-32 pb-20">
        <article className="container mx-auto px-4 max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">{news.title}</h1>
          <p className="text-sm text-muted-foreground mb-8">
            {new Date(news.createdAt).toLocaleDateString("mn-MN")}
          </p>
          <div className="prose prose-invert max-w-none text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {news.content}
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
