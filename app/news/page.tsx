import Link from "next/link";
import Image from "next/image";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { connectToDatabase } from "@/lib/mongodb";
import News from "@/lib/models/News";
import { Play } from "lucide-react";
import { canOptimizeImage, isUsableImageUrl } from "@/lib/images";
import { parseMediaUrl, youTubeThumbnail } from "@/lib/media";

export const dynamic = "force-dynamic";

type NewsItem = {
  _id: string;
  title: string;
  excerpt: string;
  imageUrl?: string;
  mediaUrl?: string;
  createdAt: string;
};

/** Жагсаалтад харагдах зураг: оруулсан зураг, эсвэл YouTube видеоны зураг */
function coverImage(item: NewsItem) {
  if (isUsableImageUrl(item.imageUrl)) return item.imageUrl;
  const media = parseMediaUrl(item.mediaUrl);
  return media?.provider === "youtube" ? youTubeThumbnail(media.videoId) : null;
}

export default async function NewsPage() {
  await connectToDatabase();
  const items = (await News.find({ status: "published" })
    .sort({ createdAt: -1 })
    .lean()) as unknown as NewsItem[];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Nav />
      <main className="flex-1 pt-32 pb-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">МЭДЭЭ</h1>
            <div className="w-20 h-1 bg-primary mx-auto" />
          </div>

          {items.length === 0 ? (
            <p className="text-center text-muted-foreground">Одоогоор мэдээ алга байна.</p>
          ) : (
            <div className="space-y-6">
              {items.map((item) => {
                const cover = coverImage(item);
                const media = parseMediaUrl(item.mediaUrl);
                return (
                  <Link key={item._id} href={`/news/${item._id}`} className="block">
                    <Card className="hover:border-primary transition-colors">
                      <CardContent className="flex flex-col sm:flex-row gap-4">
                        {(cover || media) && (
                          <div className="relative aspect-video w-full sm:w-48 shrink-0 overflow-hidden rounded-md bg-muted">
                            {cover && (
                              <Image
                                src={cover}
                                alt={item.title}
                                fill
                                sizes="(max-width: 640px) 100vw, 192px"
                                unoptimized={!canOptimizeImage(cover)}
                                className="object-cover"
                              />
                            )}
                            {media?.kind === "video" && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white">
                                  <Play className="h-5 w-5 translate-x-0.5" fill="currentColor" />
                                </span>
                              </div>
                            )}
                            {!cover && media?.kind === "post" && (
                              <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold tracking-widest text-muted-foreground">
                                FACEBOOK
                              </div>
                            )}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h2 className="text-xl font-bold text-foreground mb-2">{item.title}</h2>
                          <p className="text-muted-foreground text-sm mb-3">{item.excerpt}</p>
                          <p className="text-xs text-muted-foreground/70">
                            {new Date(item.createdAt).toLocaleDateString("mn-MN")}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
