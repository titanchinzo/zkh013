"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Хулганы дугуйг (дээш/доош) хэвтээ гүйлгээ болгоно — босоо бичвэрийн багана зүүнээс баруун тийш
 * урсдаг тул. Төгсгөлдөө хүрсэн үед хуудас ердийнхөөрөө доошоо гүйлгэгдэнэ.
 */
export function useWheelToHorizontal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = element.scrollWidth - element.clientWidth;
      if (max <= 0) return;
      const atStart = element.scrollLeft <= 0 && e.deltaY < 0;
      const atEnd = element.scrollLeft >= max - 1 && e.deltaY > 0;
      if (atStart || atEnd) return;
      e.preventDefault();
      element.scrollLeft += e.deltaY;
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);
  return ref;
}

/** Босоо бичвэрийн хэвтээ гүйлгэгч (server компонентоос ашиглана) */
export function MglScroller({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  const ref = useWheelToHorizontal<HTMLDivElement>();
  return (
    <div ref={ref} tabIndex={0} aria-label={label} className={cn("mgl-scroll outline-none", className)}>
      {children}
    </div>
  );
}
