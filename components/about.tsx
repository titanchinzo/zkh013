import Image from "next/image";
import { MapPin } from "lucide-react";
import logo from "@/public/logo.png";
import { CountUp } from "@/components/count-up";
import { Reveal } from "@/components/reveal";
import { UnitHistory } from "@/components/unit-history";
import { MglHeading } from "@/components/mgl/mgl-heading";
import { MglBand } from "@/components/mgl/mgl-ornaments";
import { CONTACT } from "@/lib/contact";
import { translateHistory } from "@/lib/mgl/history";
import { getTranslator } from "@/lib/mgl/server";
import { UNIT_STATS, UNIT_SUMMARY } from "@/lib/unit-history";

const SUBTITLE = "Хошууч генерал Р.Гаваагийн нэрэмжит Цэргийн гавьяаны улаан тугийн болон Алтан гадас одонт Зэвсэгт хүчний 013 дугаар анги";

export async function About() {
  const { script, t } = await getTranslator();
  const stats = UNIT_STATS(new Date().getFullYear());
  const history = translateHistory(t);
  const mgl = script === "mgl";

  return (
    <section id="about" className="relative overflow-hidden py-20 md:py-32 bg-background">
      {/* JavaScript ажиллахгүй үед хөдөлгөөнт хэсгүүд нуугдаж үлдэхгүй */}
      <noscript>
        <style>{".reveal{opacity:1!important;transform:none!important}"}</style>
      </noscript>
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {mgl && <MglBand className="mb-12 md:mb-16" />}
          {mgl ? (
            <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
              <Reveal className="flex shrink-0 flex-row gap-4">
                <MglHeading title={t("АНГИЙН ТУХАЙ")} />
                <p className="mgl-v h-80 text-base leading-relaxed text-muted-foreground">
                  {t("Хошууч генерал Р.Гаваагийн нэрэмжит Цэргийн гавьяаны улаан тугийн болон Алтан гадас одонт Зэвсэгт хүчний 013 дугаар анги")}
                </p>
              </Reveal>
              {/* Догол мөр бүр босоо багана; багтахгүй бол дараагийн мөрөнд (доошоо) шилжинэ */}
              <div className="flex min-w-0 flex-1 flex-row flex-wrap gap-x-6 gap-y-10">
                <Reveal>
                  <p className="mgl-v text-sm text-primary">{t("ТОВЧ НАМТАР")}</p>
                </Reveal>
                {UNIT_SUMMARY.map((paragraph, index) => (
                  <Reveal key={paragraph} delay={120 + index * 120} className="shrink-0">
                    <p className="mgl-v h-[22rem] text-lg leading-loose text-foreground/90">{t(paragraph)}</p>
                  </Reveal>
                ))}
                <Reveal delay={360} className="shrink-0">
                  <p className="mgl-v inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 text-primary" />
                    {t(CONTACT.address)}
                  </p>
                </Reveal>
              </div>
              <Reveal from="right" className="self-center">
                <SignalEmblem />
              </Reveal>
            </div>
          ) : (
            <>
              <Reveal className="text-center mb-16">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">АНГИЙН ТУХАЙ</h2>
                <div className="w-20 h-1 bg-primary mx-auto mb-6" />
                <p className="mx-auto max-w-3xl text-base md:text-lg text-muted-foreground">{SUBTITLE}</p>
              </Reveal>

              <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div>
                  <Reveal>
                    <p className="text-sm font-semibold tracking-widest text-primary">ТОВЧ НАМТАР</p>
                  </Reveal>
                  {UNIT_SUMMARY.map((paragraph, index) => (
                    <Reveal key={paragraph} delay={120 + index * 120}>
                      <p className="mt-4 text-lg leading-relaxed text-foreground/85">{paragraph}</p>
                    </Reveal>
                  ))}
                  <Reveal delay={360}>
                    <p className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 text-primary" />
                      {CONTACT.address}
                    </p>
                  </Reveal>
                </div>
                <Reveal from="right" className="justify-self-center">
                  <SignalEmblem />
                </Reveal>
              </div>
            </>
          )}

          <div className="mt-16 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map((stat, index) => (
              <Reveal key={stat.label} delay={index * 100}>
                {mgl ? (
                  <div className="flex h-full flex-row items-start justify-center gap-4 rounded-xl border border-border bg-card metallic p-5">
                    {/* Монгол цифр босоо урсана (латин тоо хажуу тийшээ хэвтдэг) */}
                    <p className="mgl-v text-4xl leading-none text-primary md:text-5xl">
                      <CountUp value={stat.value} mongolian />
                    </p>
                    <p className="mgl-v h-32 text-sm leading-relaxed text-foreground">{t(stat.label)}</p>
                    {stat.note && <p className="mgl-v h-32 text-xs text-muted-foreground">{t(stat.note)}</p>}
                  </div>
                ) : (
                  <div className="h-full rounded-xl border border-border bg-card metallic p-5 text-center">
                    <p className="text-4xl md:text-5xl font-bold tabular-nums text-primary">
                      <CountUp value={stat.value} />
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">{stat.label}</p>
                    {stat.note && <p className="mt-1 text-xs text-muted-foreground">{stat.note}</p>}
                  </div>
                )}
              </Reveal>
            ))}
          </div>

          <UnitHistory data={history} script={script} />
        </div>
      </div>
    </section>
  );
}

/** Ангийн лого, эргэн тойронд нь холбооны долгион */
function SignalEmblem() {
  return (
    <div className="relative flex h-64 w-64 sm:h-72 sm:w-72 items-center justify-center">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden
          className="signal-wave absolute inset-0 rounded-full border border-primary/50"
          style={{ animationDelay: `${i * 1.2}s` }}
        />
      ))}
      <span
        aria-hidden
        className="absolute inset-6 rounded-full border border-dashed border-primary/30 animate-[spin_30s_linear_infinite] motion-reduce:animate-none"
      />
      <span aria-hidden className="absolute inset-12 rounded-full bg-primary/5" />
      <Image
        src={logo}
        alt="Зэвсэгт хүчний 013 дугаар ангийн лого"
        sizes="160px"
        className="relative h-36 w-auto sm:h-40 drop-shadow-[0_0_24px_rgba(34,197,94,0.25)]"
      />
    </div>
  );
}
