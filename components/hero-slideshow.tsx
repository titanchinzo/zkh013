"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

export type HeroSlide = {
  src: string;
  alt: string;
  // Мэдээний зураг бол гарчиг, холбоосыг нь харуулна
  newsTitle?: string;
  newsHref?: string;
};

const INTERVAL_MS = 6000;

export function HeroSlideshow({ slides }: { slides: HeroSlide[] }) {
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
            // Мэдээний зураг гадны хаягаас ирдэг тул optimize хийхгүй шууд үзүүлнэ
            unoptimized={!slide.src.startsWith("/")}
            className={`object-cover transition-opacity duration-1000 ease-in-out ${
              i === active ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
      </div>

      {slides.length > 1 && (
        <div className="absolute bottom-8 left-0 right-0 z-30 flex flex-col items-center gap-3 px-4">
          {current?.newsTitle && current.newsHref && (
            <Link
              href={current.newsHref}
              className="max-w-xl truncate px-3 py-1 text-sm text-white bg-black/50 border border-primary/40 hover:border-primary transition-colors"
            >
              <span className="text-primary font-semibold mr-2">МЭДЭЭ</span>
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
