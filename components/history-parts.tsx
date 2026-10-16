import Image from "next/image";
import { ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  HistoryEvent,
  HistoryImage,
  HistoryLabels,
  HistoryPerson,
  Source,
  UnitAward,
} from "@/lib/unit-history";

// Ангийн түүхийн хэсгийн (MN болон MGL горимд) хамтран ашиглах жижиг компонентууд

export type OpenFn = (id: string) => void;

export type HistoryData = {
  events: HistoryEvent[];
  people: HistoryPerson[];
  awards: UnitAward[];
  labels: HistoryLabels;
};

const PORTRAIT_SIZES = {
  sm: { box: "h-14 w-11 rounded-md", sizes: "44px" },
  md: { box: "h-44 w-36 rounded-xl", sizes: "144px" },
  lg: { box: "h-40 w-32 sm:h-48 sm:w-40 rounded-xl", sizes: "160px" },
};

/** Хөрөг зураг — хулганаар заахад гэрэл гулсаж өнгөрнө */
export function Portrait({ person, size = "md" }: { person: HistoryPerson; size?: keyof typeof PORTRAIT_SIZES }) {
  const { box, sizes } = PORTRAIT_SIZES[size];
  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden border border-primary/40 bg-muted shadow-lg shadow-black/40",
        box
      )}
    >
      <Image
        src={person.photo.src}
        alt={person.photo.alt}
        fill
        sizes={sizes}
        placeholder="blur"
        className="object-cover object-top transition-transform duration-700 group-hover:scale-105"
      />
      <span aria-hidden className="absolute inset-0 bg-linear-to-t from-black/45 via-transparent to-transparent" />
      <span aria-hidden className="portrait-shine pointer-events-none absolute inset-0" />
    </span>
  );
}

/** Одонгийн тунгалаг зураг, ард нь алтан гэрэл */
export function Medal({ image, className, float }: { image: HistoryImage; className?: string; float?: boolean }) {
  return (
    <span className={cn("relative block shrink-0", className)}>
      <span
        aria-hidden
        className="absolute inset-[12%] rounded-full bg-amber-300/20 blur-2xl transition-colors duration-500 group-hover:bg-amber-300/35"
      />
      <Image
        src={image.src}
        alt={image.alt}
        fill
        sizes="(max-width: 640px) 120px, 176px"
        className={cn(
          "object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)] transition-transform duration-700 group-hover:scale-110 group-hover:rotate-[8deg]",
          float && "medal-float"
        )}
      />
    </span>
  );
}

/** Эх сурвалжийн холбоосууд (vertical — монгол бичгийн горимд босоо жагсаалт) */
export function Sources({ sources, label, vertical }: { sources: Source[]; label: string; vertical?: boolean }) {
  if (vertical) {
    return (
      <div className="flex shrink-0 flex-row gap-3 border-l border-border pl-4">
        <p className="mgl-v text-xs text-muted-foreground">{label}</p>
        {sources.map((source) => (
          <a
            key={source.url}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mgl-v inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            {source.label}
            <ExternalLink className="h-3 w-3" />
          </a>
        ))}
      </div>
    );
  }
  return (
    <div className="mt-8 border-t border-border pt-4">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {sources.map((source) => (
          <li key={source.url}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
            >
              {source.label}
              <ExternalLink className="h-3 w-3" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DialogHeader({ eyebrow, closeLabel, onClose }: { eyebrow: string; closeLabel: string; onClose: () => void }) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-card/95 px-6 py-3 backdrop-blur sm:px-8">
      <span className="text-xs font-bold tracking-widest text-primary">{eyebrow}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
