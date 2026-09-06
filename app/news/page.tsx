import Link from "next/link";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { connectToDatabase } from "@/lib/mongodb";
import News from "@/lib/models/News";

export const dynamic = "force-dynamic";

type NewsItem = {
  _id: string;
  title: string;
  excerpt: string;
  createdAt: string;
};

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
              {items.map((item) => (
                <Link key={item._id} href={`/news/${item._id}`}>
                  <Card className="hover:border-primary transition-colors">
                    <CardContent>
                      <h2 className="text-xl font-bold text-foreground mb-2">{item.title}</h2>
                      <p className="text-muted-foreground text-sm mb-3">{item.excerpt}</p>
                      <p className="text-xs text-muted-foreground/70">
                        {new Date(item.createdAt).toLocaleDateString("mn-MN")}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
