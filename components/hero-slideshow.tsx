"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { canOptimizeImage } from "@/lib/images";

export type HeroSlide = {
  src: string;
  alt: string;
  // Мэдээний зураг бол гарчиг, холбоосыг нь харуулна
  newsTitle?: string;
  newsHref?: string;
};

const INTERVAL_MS = 6000;

type Props = {
  slides: HeroSlide[];
  newsLabel?: string;
  // Монгол бичгийн горимд мэдээний гарчиг баруун талд босоо харагдана
  vertical?: boolean;
};

export function HeroSlideshow({ slides, newsLabel = "МЭДЭЭ", vertical = false }: Props) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setActive((i) => (i + 1) % slides.length), INTERVAL_MS);
    return () => clearInterval(timer);
  }, [slides.length]);

  const current = slides[active];

  return (
    <>
      <div className="absolute inset-0 overflow-hidden">
        {slides.map((slide, i) => (
          <Image
            key={slide.src}
            src={slide.src}
            alt={slide.alt}
            fill
            sizes="100vw"
            preload={i === 0}
            // Upload хийсэн (Vercel Blob) зургийг optimize хийнэ, бусад гадны хаягийг шууд үзүүлнэ
            unoptimized={!canOptimizeImage(slide.src)}
            className={`object-cover transition-opacity duration-1000 ease-in-out ${
              i === active ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
      </div>

      {vertical && current?.newsTitle && current.newsHref && (
        <Link
          href={current.newsHref}
          // Жижиг дэлгэцэд hero-ийн баганууд бүх өргөнийг эзэлдэг тул зөвхөн том дэлгэцэд харуулна
          className="mgl-v absolute bottom-20 right-8 z-30 hidden max-h-[42vh] overflow-hidden border border-primary/40 bg-black/55 px-2 py-3 text-sm leading-relaxed text-white transition-colors hover:border-primary xl:block"
        >
          <span className="mb-2 text-primary">{newsLabel}</span>
          {current.newsTitle}
        </Link>
      )}

      {slides.length > 1 && (
        <div className="absolute bottom-8 left-0 right-0 z-30 flex flex-col items-center gap-3 px-4">
          {!vertical && current?.newsTitle && current.newsHref && (
            <Link
              href={current.newsHref}
              className="max-w-xl truncate px-3 py-1 text-sm text-white bg-black/50 border border-primary/40 hover:border-primary transition-colors"
            >
              <span className="text-primary font-semibold mr-2">{newsLabel}</span>
              {current.newsTitle}
            </Link>
          )}
          <div className="flex gap-2">
            {slides.map((slide, i) => (
              <button
                key={slide.src}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`${i + 1}-р зураг`}
                className={`h-1.5 transition-all ${
                  i === active ? "w-8 bg-primary" : "w-4 bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
