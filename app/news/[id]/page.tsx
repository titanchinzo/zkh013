import { notFound } from "next/navigation";
import Image from "next/image";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { connectToDatabase } from "@/lib/mongodb";
import News from "@/lib/models/News";
import { NewsMediaEmbed } from "@/components/news-media";
import { canOptimizeImage, isUsableImageUrl } from "@/lib/images";
import { parseMediaUrl } from "@/lib/media";

export const dynamic = "force-dynamic";

type NewsDoc = {
  title: string;
  content: string;
  imageUrl?: string;
  mediaUrl?: string;
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

  // Видео/пост хавсаргасан бол зургийн оронд түүнийг харуулна (зураг нь жагсаалт, нүүр хуудсанд гарна)
  const media = parseMediaUrl(news.mediaUrl);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Nav />
      <main className="flex-1 pt-32 pb-20">
        <article className="container mx-auto px-4 max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">{news.title}</h1>
          <p className="text-sm text-muted-foreground mb-8">
            {new Date(news.createdAt).toLocaleDateString("mn-MN")}
          </p>
          {media ? (
            <div className="mb-8">
              <NewsMediaEmbed media={media} title={news.title} />
            </div>
          ) : isUsableImageUrl(news.imageUrl) && (
            <div className="relative aspect-video w-full overflow-hidden rounded-md border border-border mb-8">
              <Image
                src={news.imageUrl}
                alt={news.title}
                fill
                preload
                sizes="(max-width: 768px) 100vw, 768px"
                unoptimized={!canOptimizeImage(news.imageUrl)}
                className="object-cover"
              />
            </div>
          )}
          <div className="prose prose-invert max-w-none text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {news.content}
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
