"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { canOptimizeImage } from "@/lib/images";
import { cn } from "@/lib/utils";

const SWIPE_PX = 50;

/** Мэдээний зургийн цомог: дарахад бүтэн дэлгэцээр (сум, Esc, шударч) гүйлгэж үзнэ */
export function NewsGallery({ images, title }: { images: string[]; title: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const touchX = useRef<number | null>(null);
  const count = images.length;

  const show = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);
  const close = useCallback(() => setIndex(null), []);

  useEffect(() => {
    if (index === null) return;
    const current = index;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") show(current + 1);
      else if (e.key === "ArrowLeft") show(current - 1);
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [index, show, close]);

  if (count === 0) return null;

  return (
    <>
      <div
        className={cn(
          "grid gap-2",
          count === 1 ? "grid-cols-1" : count === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"
        )}
      >
        {images.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => show(i)}
            aria-label={`${i + 1}-р зургийг томруулж үзэх`}
            className={cn(
              "group relative overflow-hidden rounded-md border border-border bg-muted",
              count === 1 ? "aspect-video" : "aspect-[4/3]"
            )}
          >
            <Image
              src={url}
              alt={`${title} — ${i + 1}`}
              fill
              sizes={count === 1 ? "(max-width: 768px) 100vw, 768px" : "(max-width: 640px) 50vw, 260px"}
              unoptimized={!canOptimizeImage(url)}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {index !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} — зургийн цомог`}
          onClick={close}
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) > SWIPE_PX) show(index + (dx < 0 ? 1 : -1));
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95"
        >
          <span className="absolute left-4 top-4 text-sm text-gray-300">
            {index + 1} / {count}
          </span>
          <button
            type="button"
            onClick={close}
            aria-label="Хаах"
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-white hover:bg-white/10"
          >
            <X className="h-7 w-7" />
          </button>

          <div className="relative mx-4 h-[80vh] w-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
            <Image
              key={images[index]}
              src={images[index]}
              alt={`${title} — ${index + 1}`}
              fill
              sizes="100vw"
              unoptimized={!canOptimizeImage(images[index])}
              className="object-contain"
            />
          </div>

          {count > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  show(index - 1);
                }}
                aria-label="Өмнөх зураг"
                className="absolute left-2 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white hover:bg-primary hover:text-primary-foreground"
              >
                <ChevronLeft className="h-7 w-7" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  show(index + 1);
                }}
                aria-label="Дараагийн зураг"
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white hover:bg-primary hover:text-primary-foreground"
              >
                <ChevronRight className="h-7 w-7" />
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
