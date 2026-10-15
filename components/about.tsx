import Image from "next/image";
import { MapPin } from "lucide-react";
import logo from "@/public/logo.png";
import { CountUp } from "@/components/count-up";
import { Reveal } from "@/components/reveal";
import { UnitHistory } from "@/components/unit-history";
import { CONTACT } from "@/lib/contact";
import { UNIT_STATS, UNIT_SUMMARY } from "@/lib/unit-history";

export function About() {
  const stats = UNIT_STATS(new Date().getFullYear());

  return (
    <section id="about" className="relative overflow-hidden py-20 md:py-32 bg-background">
      {/* JavaScript ажиллахгүй үед хөдөлгөөнт хэсгүүд нуугдаж үлдэхгүй */}
      <noscript>
        <style>{".reveal{opacity:1!important;transform:none!important}"}</style>
      </noscript>
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">АНГИЙН ТУХАЙ</h2>
            <div className="w-20 h-1 bg-primary mx-auto mb-6" />
            <p className="mx-auto max-w-3xl text-base md:text-lg text-muted-foreground">
              Хошууч генерал Р.Гаваагийн нэрэмжит Цэргийн гавьяаны улаан туг, Алтан гадас одонт Зэвсэгт хүчний
              013 дугаар анги
            </p>
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

          <div className="mt-16 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map((stat, index) => (
              <Reveal key={stat.label} delay={index * 100}>
                <div className="h-full rounded-xl border border-border bg-card metallic p-5 text-center">
                  <p className="text-4xl md:text-5xl font-bold tabular-nums text-primary">
                    <CountUp value={stat.value} />
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">{stat.label}</p>
                  {stat.note && <p className="mt-1 text-xs text-muted-foreground">{stat.note}</p>}
                </div>
              </Reveal>
            ))}
          </div>

          <UnitHistory />
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
