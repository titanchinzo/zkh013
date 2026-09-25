import { HeroSlideshow, type HeroSlide } from "@/components/hero-slideshow";
import { connectToDatabase } from "@/lib/mongodb";
import News from "@/lib/models/News";

const BASE_SLIDES: HeroSlide[] = [1, 2, 3, 4].map((n) => ({
  src: `/hero/hero-${n}.jpg`,
  alt: "Зэвсэгт хүчний 013 дугаар анги",
}));

// Hero-д ээлжлэн гарах нийтлэгдсэн мэдээний зургийн дээд тоо
const MAX_NEWS_SLIDES = 5;

function isUsableImageUrl(url: string) {
  if (url.startsWith("/")) return true;
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

async function getNewsSlides(): Promise<HeroSlide[]> {
  try {
    await connectToDatabase();
    const items = (await News.find({ status: "published", imageUrl: { $ne: "" } })
      .sort({ createdAt: -1 })
      .limit(MAX_NEWS_SLIDES)
      .select("title imageUrl")
      .lean()) as unknown as { _id: unknown; title: string; imageUrl: string }[];

    return items
      .filter((item) => isUsableImageUrl(item.imageUrl))
      .map((item) => ({
        src: item.imageUrl,
        alt: item.title,
        newsTitle: item.title,
        newsHref: `/news/${String(item._id)}`,
      }));
  } catch (err) {
    // Мэдээ татаж чадахгүй бол нүүр хуудсыг унагахгүй, үндсэн зургуудаа л харуулна
    console.error("[hero] мэдээний зураг татаж чадсангүй:", err);
    return [];
  }
}

export async function Hero() {
  const newsSlides = await getNewsSlides();
  const seen = new Set<string>();
  const slides = [...newsSlides, ...BASE_SLIDES].filter((slide) => {
    if (seen.has(slide.src)) return false;
    seen.add(slide.src);
    return true;
  });

  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden tactical-grid bg-black"
    >
      <HeroSlideshow slides={slides} />
      <div className="absolute inset-0 bg-black/65 z-20" />
      <div className="absolute inset-0 flex items-center justify-center opacity-10 z-25">
        <div className="relative w-[600px] h-[600px]">
          <div className="absolute inset-0 border border-primary/30 rounded-full" />
          <div className="absolute inset-8 border border-primary/20 rounded-full" />
          <div className="absolute inset-16 border border-primary/10 rounded-full" />
          <div className="absolute top-1/2 left-1/2 w-1/2 h-0.5 bg-gradient-to-r from-primary/50 to-transparent origin-left radar-sweep" />
        </div>
      </div>
      <div className="relative z-30 container mx-auto px-4 text-center">
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
          <div className="inline-block px-4 py-1 border border-primary bg-primary/20 text-white text-sm font-semibold tracking-widest mb-4">
            ХОШУУЧ ГЕНЕРАЛ Р.ГАВААГИЙН НЭРЭМЖИТ
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white text-balance drop-shadow-[0_4px_12px_rgba(0,0,0,1)]">
            БАЙЛДААНЫ ГАВЯАНЫ УЛААН ТУГИЙН БОЛОН АЛТАН ГАДАС ОДОНТ
            <span className="block text-primary mt-2 drop-shadow-[0_4px_12px_rgba(0,0,0,1)]">
              ЗЭВСЭГТ ХҮЧНИЙ 013 ДУГААР АНГИ
            </span>
          </h1>
          <p className="text-lg md:text-xl text-gray-200 max-w-2xl mx-auto leading-relaxed drop-shadow-[0_4px_8px_rgba(0,0,0,1)]">
            Эх орны бүрэн эрхт байдал, аюулгүй байдлыг хамгаалах, иргэдийн амь нас, эд хөрөнгийг хамгаалахад
            зориулагдсан.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <a
              href="#contact"
              className="inline-flex items-center justify-center h-12 px-8 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-all"
            >
              Холбоо барих
            </a>
            <a
              href="#about"
              className="inline-flex items-center justify-center h-12 px-8 rounded-md border border-primary text-primary hover:bg-primary/10 bg-black/40 font-semibold transition-all"
            >
              Дэлгэрэнгүй
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
