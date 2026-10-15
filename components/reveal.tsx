"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const OFFSETS = {
  up: ["0px", "28px"],
  left: ["-40px", "0px"],
  right: ["40px", "0px"],
} as const;

type Props = {
  children: ReactNode;
  className?: string;
  delay?: number;
  from?: keyof typeof OFFSETS;
};

/** Дэлгэцэнд орж ирэхэд зөөлөн гарч ирнэ (хөдөлгөөн багасгах тохиргоотой үед шууд харагдана) */
export function Reveal({ children, className, delay = 0, from = "up" }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        element.dataset.shown = "";
        observer.disconnect();
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const [x, y] = OFFSETS[from];
  return (
    <div
      ref={ref}
      className={cn("reveal", className)}
      style={{ "--reveal-x": x, "--reveal-y": y, "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
