import { HeroSlideshow, type HeroSlide } from "@/components/hero-slideshow";
import { connectToDatabase } from "@/lib/mongodb";
import News from "@/lib/models/News";
import { isUsableImageUrl } from "@/lib/images";
import { toMgl } from "@/lib/mgl/convert";
import { getTranslator, type Translate } from "@/lib/mgl/server";
import { MglFrame } from "@/components/mgl/mgl-ornaments";

const BASE_SLIDES: HeroSlide[] = [1, 2, 3, 4].map((n) => ({
  src: `/hero/hero-${n}.jpg`,
  alt: "Зэвсэгт хүчний 013 дугаар анги",
}));

// Hero-д ээлжлэн гарах нийтлэгдсэн мэдээний зургийн дээд тоо
const MAX_NEWS_SLIDES = 5;

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
  const [newsSlides, { script, t }] = await Promise.all([getNewsSlides(), getTranslator()]);
  const seen = new Set<string>();
  let slides = [...newsSlides, ...BASE_SLIDES].filter((slide) => {
    if (seen.has(slide.src)) return false;
    seen.add(slide.src);
    return true;
  });
  const mgl = script === "mgl";
  if (mgl) {
    // Мэдээний гарчгийг монгол бичигт хөрвүүлнэ
    const titles = await toMgl(slides.map((slide) => slide.newsTitle ?? ""));
    slides = slides.map((slide, i) => (slide.newsTitle ? { ...slide, newsTitle: titles[i] } : slide));
  }

  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden tactical-grid bg-black"
    >
      <HeroSlideshow slides={slides} newsLabel={t("МЭДЭЭ")} vertical={mgl} />
      <div className="absolute inset-0 bg-black/65 z-20" />
      <div className="absolute inset-0 flex items-center justify-center opacity-10 z-25">
        <div className="relative w-[600px] h-[600px]">
          <div className="absolute inset-0 border border-primary/30 rounded-full" />
          <div className="absolute inset-8 border border-primary/20 rounded-full" />
          <div className="absolute inset-16 border border-primary/10 rounded-full" />
          <div className="absolute top-1/2 left-1/2 w-1/2 h-0.5 bg-gradient-to-r from-primary/50 to-transparent origin-left radar-sweep" />
        </div>
      </div>
      {mgl ? (
        <MglHeroContent t={t} />
      ) : (
      <div className="relative z-30 container mx-auto px-4 text-center">
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
          {/* Дарахад "Ангийн тухай" хэсэгт Р.Гаваагийн намтар нээгдэнэ (components/unit-history.tsx) */}
          <a
            href="#hun-gavaa"
            className="inline-block px-4 py-1 border border-primary bg-primary/20 hover:bg-primary/35 transition-colors text-white text-sm font-semibold tracking-widest mb-4"
          >
            ХОШУУЧ ГЕНЕРАЛ Р.ГАВААГИЙН НЭРЭМЖИТ
          </a>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white text-balance drop-shadow-[0_4px_12px_rgba(0,0,0,1)]">
            ЦЭРГИЙН ГАВЬЯАНЫ УЛААН ТУГ, АЛТАН ГАДАС ОДОНТ
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
      )}
    </section>
  );
}

/**
 * Монгол бичгийн горим: гарчиг, тэмдэг нь алхан хээтэй хүрээн доторх босоо баганууд, товчнууд хажууд нь.
 * Утас, таблет дээр багтахгүй тул товчнууд хүрээний доор шилжинэ.
 */
function MglHeroContent({ t }: { t: Translate }) {
  return (
    <div className="relative z-30 flex w-full justify-center px-4 py-24 lg:py-28">
      <div className="flex max-w-full flex-col items-center gap-6 animate-fade-in-up lg:flex-row lg:gap-8">
        <MglFrame className="h-[min(58vh,480px)] max-w-full bg-black/40 backdrop-blur-[2px] lg:h-[min(68vh,560px)]">
          <div className="flex h-full max-w-full flex-row items-stretch gap-2.5 overflow-x-auto px-2.5 py-5 sm:gap-6 sm:px-6 sm:py-7">
            <a
              href="#hun-gavaa"
              className="mgl-v self-center border border-gold/60 bg-gold/10 px-2 py-4 text-sm leading-relaxed text-gold transition-colors hover:bg-gold/20 sm:text-base"
            >
              {t("ХОШУУЧ ГЕНЕРАЛ Р.ГАВААГИЙН НЭРЭМЖИТ")}
            </a>
            <h1 className="mgl-v text-2xl leading-[1.45] text-white drop-shadow-[0_4px_12px_rgba(0,0,0,1)] sm:text-3xl lg:text-4xl xl:text-5xl">
              {t("ЦЭРГИЙН ГАВЬЯАНЫ УЛААН ТУГ, АЛТАН ГАДАС ОДОНТ")}
              <span className="block text-gold">{t("ЗЭВСЭГТ ХҮЧНИЙ 013 ДУГААР АНГИ")}</span>
            </h1>
            <p className="mgl-v text-base leading-relaxed text-gray-200 drop-shadow-[0_4px_8px_rgba(0,0,0,1)] sm:text-lg xl:text-xl">
              {t("Эх орны бүрэн эрхт байдал, аюулгүй байдлыг хамгаалах, иргэдийн амь нас, эд хөрөнгийг хамгаалахад зориулагдсан.")}
            </p>
          </div>
        </MglFrame>
        <div className="flex flex-row items-center gap-3">
          <a
            href="#contact"
            className="mgl-v rounded-md bg-primary px-3 py-5 text-base text-primary-foreground transition-all hover:bg-primary/90 sm:text-lg lg:py-6"
          >
            {t("Холбоо барих")}
          </a>
          <a
            href="#about"
            className="mgl-v rounded-md border border-primary bg-black/40 px-3 py-5 text-base text-primary transition-all hover:bg-primary/10 sm:text-lg lg:py-6"
          >
            {t("Дэлгэрэнгүй")}
          </a>
        </div>
      </div>
    </div>
  );
}
