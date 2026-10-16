"use client";

import { useEffect, useRef, useState } from "react";
import { mglDigits } from "@/lib/mgl/shared";

/**
 * Дэлгэцэнд харагдахад 0-ээс тоо хүртэл өсч гарна (server дээр эцсийн утгаараа зурагдана).
 * mongolian — монгол бичгийн горимд монгол цифрээр (᠙᠗).
 */
export function CountUp({ value, duration = 1600, mongolian }: { value: number; duration?: number; mongolian?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          setDisplay(Math.round(value * (1 - Math.pow(1 - t, 3))));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.5 }
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return <span ref={ref}>{mongolian ? mglDigits(String(display)) : display}</span>;
}
