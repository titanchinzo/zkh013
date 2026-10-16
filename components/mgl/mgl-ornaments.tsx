import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Монгол бичгийн горимын уламжлалт хээ угалз: өлзий хээ, алхан хээ, хүрээний булан.
// Бүгд currentColor-оор будагдана (жишээ нь text-gold).

/** Өлзий хээ (төгсгөлгүй зангилаа) — хэсгийн гарчгийн оройд */
export function UlziiKnot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("shrink-0", className)}>
      <g transform="rotate(45 16 16)">
        <path
          d="M8 11H24A3 3 0 1 0 21 8V24A3 3 0 1 0 24 21H8A3 3 0 1 0 11 24V8A3 3 0 1 0 8 11Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <rect x="14" y="14" width="4" height="4" fill="currentColor" />
      </g>
    </svg>
  );
}

/** Алхан хээ — хэсгийн эхлэлд хэвтээ зурвас (globals.css-ийн .mgl-band) */
export function MglBand({ className }: { className?: string }) {
  return <div aria-hidden className={cn("mgl-band w-full text-gold/40", className)} />;
}

// Хүрээний зүүн дээд булан: гадна талын өнцөг, дотор нь алхан хээний дэгээ
const CORNER_PATH = "M1 23V1H23M5.5 16V5.5H16M10 10H13V13";
const CORNERS = ["left-0 top-0", "right-0 top-0 -scale-x-100", "bottom-0 left-0 -scale-y-100", "bottom-0 right-0 -scale-100"];

/** Уламжлалт хүрээ: давхар нарийн шугам, дөрвөн буланд нь алхан хээ */
export function MglFrame({
  children,
  className,
  innerClassName,
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <div className={cn("relative border border-gold/40 p-1 sm:p-1.5", className)}>
      <div className={cn("h-full border border-gold/20", innerClassName)}>{children}</div>
      {CORNERS.map((position) => (
        <svg
          key={position}
          viewBox="0 0 24 24"
          aria-hidden
          className={cn("pointer-events-none absolute h-5 w-5 text-gold", position)}
        >
          <path d={CORNER_PATH} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
        </svg>
      ))}
    </div>
  );
}
