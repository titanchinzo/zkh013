"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, ExternalLink, FileText, X } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { cn } from "@/lib/utils";
import {
  HISTORY_EVENTS,
  HISTORY_PEOPLE,
  UNIT_AWARDS,
  type HistoryDocument,
  type HistoryEvent,
  type HistoryImage,
  type HistoryPerson,
  type Source,
} from "@/lib/unit-history";

type Active = { kind: "event"; item: HistoryEvent } | { kind: "person"; item: HistoryPerson } | null;
type OpenFn = (id: string) => void;
type Viewer = { documents: HistoryDocument[]; index: number } | null;

function findById(id: string): Active {
  const event = HISTORY_EVENTS.find((item) => item.id === id);
  if (event) return { kind: "event", item: event };
  const person = HISTORY_PEOPLE.find((item) => item.id === id);
  return person ? { kind: "person", item: person } : null;
}

const personById = (id?: string) => (id ? HISTORY_PEOPLE.find((person) => person.id === id) : undefined);

/**
 * Ангийн түүхэн замнал, түүхэн хүмүүс, шагнал. Үйл явдал/хүн дээр дарахад дэлгэрэнгүй цонх
 * нээгдэж, хаяг нь холбоос болно (жишээ нь /#tuukh-1936, /#hun-gavaa) — хуваалцаж болно.
 */
export function UnitHistory() {
  const [active, setActive] = useState<Active>(null);
  const [viewer, setViewer] = useState<Viewer>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const open = useCallback<OpenFn>((id) => {
    const next = findById(id);
    if (!next) return;
    setActive(next);
    window.history.replaceState(null, "", `#${id}`);
  }, []);

  const close = useCallback(() => dialogRef.current?.close(), []);

  // Холбоосоор орж ирсэн (/#hun-gavaa) эсвэл хуудсан дээрх #... холбоос дарсан үед нээнэ
  useEffect(() => {
    const openFromHash = () => {
      const next = findById(decodeURIComponent(window.location.hash.slice(1)));
      if (next) setActive(next);
    };
    const frame = requestAnimationFrame(openFromHash);
    window.addEventListener("hashchange", openFromHash);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", openFromHash);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!active || !dialog) return;
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
  }, [active]);

  function handleClose(e: React.SyntheticEvent<HTMLDialogElement>) {
    // Баримт үзэх цонхны "close" үйл явдал энд дамжиж ирэхээс сэргийлнэ
    if (e.target !== e.currentTarget) return;
    setActive(null);
    setViewer(null);
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }

  return (
    <>
      <Timeline onOpen={open} />
      <People onOpen={open} />
      <Awards onOpen={open} />

      <dialog
        ref={dialogRef}
        onClose={handleClose}
        // Цонхны гадна (бүдгэрсэн хэсэг) дарахад хаагдана
        onClick={(e) => e.target === e.currentTarget && close()}
        aria-labelledby="history-dialog-title"
        className="history-dialog m-auto max-h-[88vh] w-[min(44rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl shadow-black/60 backdrop:bg-black/80 backdrop:backdrop-blur-sm"
      >
        {active?.kind === "event" && <EventDetails event={active.item} onOpen={open} onClose={close} />}
        {active?.kind === "person" && (
          <PersonDetails
            person={active.item}
            onClose={close}
            onViewDocument={(index) => setViewer({ documents: active.item.documents ?? [], index })}
          />
        )}
      </dialog>

      <DocumentViewer viewer={viewer} onChange={setViewer} />
    </>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <Reveal className="text-center">
      <p className="text-sm font-semibold tracking-widest text-primary">{eyebrow}</p>
      <h3 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight text-foreground">{title}</h3>
      <div className="mx-auto mt-4 h-1 w-16 bg-primary" />
    </Reveal>
  );
}

/* ---------------------------------- Зураг ---------------------------------- */

const PORTRAIT_SIZES = {
  sm: { box: "h-14 w-11 rounded-md", sizes: "44px" },
  md: { box: "h-44 w-36 rounded-xl", sizes: "144px" },
  lg: { box: "h-40 w-32 sm:h-48 sm:w-40 rounded-xl", sizes: "160px" },
};

/** Хөрөг зураг — хулганаар заахад гэрэл гулсаж өнгөрнө */
function Portrait({ person, size = "md" }: { person: HistoryPerson; size?: keyof typeof PORTRAIT_SIZES }) {
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
function Medal({ image, className, float }: { image: HistoryImage; className?: string; float?: boolean }) {
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

/* ---------------------------------- Түүхэн замнал ---------------------------------- */

function Timeline({ onOpen }: { onOpen: OpenFn }) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Гүйлгэх тусам шугам зурагдаж, давсан үйл явдлын цэг гэрэлтэнэ
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const items = Array.from(container.querySelectorAll<HTMLElement>(".timeline-item"));
    let frame = 0;

    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.65;
      const rect = container.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, (line - rect.top) / rect.height));
      container.style.setProperty("--progress", progress.toFixed(4));
      for (const item of items) {
        item.toggleAttribute("data-passed", item.getBoundingClientRect().top + 28 < line);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="mt-24">
      <SectionTitle eyebrow="1929 – ӨНӨӨ" title="ТҮҮХЭН ЗАМНАЛ" />
      <div ref={containerRef} className="relative mt-14">
        <div aria-hidden className="absolute bottom-0 top-0 left-4 w-0.5 -translate-x-1/2 bg-border md:left-1/2" />
        <div
          aria-hidden
          className="timeline-progress absolute bottom-0 top-0 left-4 w-0.5 -translate-x-1/2 origin-top bg-linear-to-b from-primary via-primary to-primary/30 md:left-1/2"
        />
        <ol className="space-y-8 md:space-y-10">
          {HISTORY_EVENTS.map((event, index) => (
            <TimelineItem key={event.id} event={event} index={index} onOpen={onOpen} />
          ))}
        </ol>
      </div>
    </div>
  );
}

function TimelineItem({ event, index, onOpen }: { event: HistoryEvent; index: number; onOpen: OpenFn }) {
  // Том дэлгэцэнд картууд зүүн, баруун талаар ээлжилнэ
  const cardLeft = index % 2 === 0;
  const person = personById(event.personId);

  return (
    <li id={event.id} className="timeline-item relative scroll-mt-28 md:grid md:grid-cols-[1fr_5rem_1fr] md:items-center">
      <span
        aria-hidden
        className="absolute left-4 top-7 z-10 -translate-x-1/2 md:static md:col-start-2 md:row-start-1 md:mx-auto md:translate-x-0"
      >
        <span className="timeline-dot block h-4 w-4 rounded-full border-2 border-primary bg-background" />
      </span>

      <div
        className={cn(
          "hidden md:row-start-1 md:block",
          cardLeft ? "md:col-start-3 md:text-left" : "md:col-start-1 md:text-right"
        )}
      >
        <Reveal from={cardLeft ? "right" : "left"}>
          <span className="timeline-year text-5xl font-bold tracking-tight">{event.year}</span>
        </Reveal>
      </div>

      <Reveal
        from={cardLeft ? "left" : "right"}
        delay={80}
        className={cn("pl-12 md:row-start-1 md:pl-0", cardLeft ? "md:col-start-1" : "md:col-start-3")}
      >
        <button
          type="button"
          onClick={() => onOpen(event.id)}
          className="group flex w-full items-start gap-4 rounded-xl border border-border bg-card metallic p-5 text-left transition duration-300 hover:-translate-y-1 hover:border-primary/70 hover:shadow-lg hover:shadow-primary/10"
        >
          <span className="min-w-0 flex-1">
            <span className="inline-block rounded bg-primary/15 px-2 py-0.5 text-xs font-bold tracking-wider text-primary">
              {event.year}
            </span>
            <span className="mt-3 block text-lg font-bold leading-snug text-foreground transition-colors group-hover:text-primary">
              {event.title}
            </span>
            <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">{event.summary}</span>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
              Дэлгэрэнгүй
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </span>
          {event.image ? (
            <Medal image={event.image} className="h-16 w-16 sm:h-20 sm:w-20" />
          ) : (
            person && <Portrait person={person} size="sm" />
          )}
        </button>
      </Reveal>
    </li>
  );
}

/* ---------------------------------- Түүхэн хүмүүс ---------------------------------- */

function People({ onOpen }: { onOpen: OpenFn }) {
  return (
    <div className="mt-24">
      <SectionTitle eyebrow="АНГИЙН БАХАРХАЛ" title="ТҮҮХЭН ХҮМҮҮС" />
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {HISTORY_PEOPLE.map((person, index) => (
          <Reveal key={person.id} delay={index * 120}>
            <button
              id={person.id}
              type="button"
              onClick={() => onOpen(person.id)}
              className="group flex h-full w-full scroll-mt-28 flex-col items-center gap-6 rounded-2xl border border-border bg-card metallic p-7 text-center transition duration-300 hover:-translate-y-1 hover:border-primary/70 hover:shadow-lg hover:shadow-primary/10 sm:flex-row sm:items-start sm:text-left"
            >
              <Portrait person={person} />
              <span className="block min-w-0">
                <span className="block text-xs font-bold tracking-widest text-primary">{person.role.toUpperCase()}</span>
                <span className="mt-1 block text-2xl font-bold text-foreground transition-colors group-hover:text-primary">
                  {person.rank} {person.shortName}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {person.name} · {person.lifespan}
                </span>
                <span className="mt-3 block text-sm leading-relaxed text-foreground/80">{person.tagline}</span>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  Намтар үзэх
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </span>
            </button>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------- Шагнал ---------------------------------- */

function Awards({ onOpen }: { onOpen: OpenFn }) {
  return (
    <div className="mt-24">
      <SectionTitle eyebrow="ТӨРИЙН ДЭЭД ШАГНАЛ" title="ШАГНАЛ, ОДОН" />
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {UNIT_AWARDS.map((award, index) => (
          <Reveal key={award.eventId} delay={index * 120}>
            <button
              type="button"
              onClick={() => onOpen(award.eventId)}
              className="group flex h-full w-full items-center gap-6 rounded-2xl border border-border bg-card metallic p-6 text-left transition duration-300 hover:-translate-y-1 hover:border-primary/70 hover:shadow-lg hover:shadow-primary/10"
            >
              <Medal image={award.image} className="h-28 w-28 sm:h-36 sm:w-36" />
              <span className="block min-w-0">
                <span className="block text-sm font-bold text-primary">{award.year}</span>
                <span className="mt-1 block text-xl font-bold leading-snug text-foreground transition-colors group-hover:text-primary">
                  {award.name}
                </span>
                <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">{award.reason}</span>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  Дэлгэрэнгүй
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </span>
            </button>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------- Дэлгэрэнгүй цонх ---------------------------------- */

function DialogHeader({ eyebrow, onClose }: { eyebrow: string; onClose: () => void }) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-card/95 px-6 py-3 backdrop-blur sm:px-8">
      <span className="text-xs font-bold tracking-widest text-primary">{eyebrow}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Хаах"
        className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

function Sources({ sources }: { sources: Source[] }) {
  return (
    <div className="mt-8 border-t border-border pt-4">
      <p className="text-xs font-semibold text-muted-foreground">Эх сурвалж:</p>
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

function EventDetails({ event, onOpen, onClose }: { event: HistoryEvent; onOpen: OpenFn; onClose: () => void }) {
  const index = HISTORY_EVENTS.findIndex((item) => item.id === event.id);
  const previous = HISTORY_EVENTS[index - 1];
  const next = HISTORY_EVENTS[index + 1];
  const person = personById(event.personId);

  return (
    <article>
      <DialogHeader eyebrow={`ТҮҮХЭН ЗАМНАЛ · ${index + 1}/${HISTORY_EVENTS.length}`} onClose={onClose} />
      <div className="px-6 pb-6 pt-6 sm:px-8 sm:pb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-5xl font-bold tracking-tight text-primary">{event.year}</p>
            <h3 id="history-dialog-title" className="mt-2 text-2xl font-bold leading-snug text-foreground">
              {event.title}
            </h3>
          </div>
          {event.image && (
            <figure className="shrink-0 text-center">
              <Medal image={event.image} className="h-28 w-28 sm:h-36 sm:w-36" float />
              {event.image.note && (
                <figcaption className="mt-1 max-w-36 text-[10px] leading-tight text-muted-foreground">
                  {event.image.note}
                </figcaption>
              )}
            </figure>
          )}
        </div>
        <div className="mt-5 space-y-4 text-base leading-relaxed text-foreground/85">
          {event.details.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        {person && (
          <button
            type="button"
            onClick={() => onOpen(person.id)}
            className="group mt-6 flex w-full items-center gap-4 rounded-xl border border-primary/40 bg-primary/5 p-4 text-left transition-colors hover:border-primary"
          >
            <Portrait person={person} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold tracking-wider text-primary">НАМТАР</span>
              <span className="block font-bold text-foreground">
                {person.rank} {person.shortName}
              </span>
            </span>
            <ArrowRight className="h-5 w-5 text-primary transition-transform group-hover:translate-x-1" />
          </button>
        )}

        <Sources sources={event.sources} />

        <nav aria-label="Түүхэн замнал" className="mt-6 flex items-center justify-between gap-3">
          {previous ? (
            <button
              type="button"
              onClick={() => onOpen(previous.id)}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 h-9 text-sm font-medium hover:border-primary hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              {previous.year}
            </button>
          ) : (
            <span />
          )}
          {next && (
            <button
              type="button"
              onClick={() => onOpen(next.id)}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 h-9 text-sm font-medium hover:border-primary hover:text-primary"
            >
              {next.year}
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </nav>
      </div>
    </article>
  );
}

function PersonDetails({
  person,
  onClose,
  onViewDocument,
}: {
  person: HistoryPerson;
  onClose: () => void;
  onViewDocument: (index: number) => void;
}) {
  return (
    <article>
      <DialogHeader eyebrow={person.role.toUpperCase()} onClose={onClose} />
      <div className="px-6 pb-6 pt-6 sm:px-8 sm:pb-8">
        <div className="group flex items-center gap-5">
          <Portrait person={person} size="lg" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary">{person.rank}</p>
            <h3 id="history-dialog-title" className="text-2xl sm:text-3xl font-bold leading-snug text-foreground">
              {person.name}
            </h3>
            <p className="text-sm text-muted-foreground">{person.lifespan}</p>
            <p className="mt-3 hidden text-sm leading-relaxed text-foreground/80 sm:block">{person.tagline}</p>
          </div>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          {person.facts.map((fact) => (
            <div key={fact.label} className="rounded-lg border border-border bg-background/60 p-3">
              <dt className="text-xs text-muted-foreground">{fact.label}</dt>
              <dd className="mt-1 text-sm font-semibold text-foreground">{fact.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 space-y-4 text-base leading-relaxed text-foreground/85">
          {person.bio.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        <h4 className="mt-8 text-xs font-bold tracking-widest text-primary">ОН ДАРААЛАЛ</h4>
        <ol className="mt-4 space-y-3 border-l-2 border-primary/40 pl-5">
          {person.milestones.map((milestone) => (
            <li key={milestone.year + milestone.text} className="relative text-sm leading-relaxed">
              <span aria-hidden className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-card" />
              <span className="mr-2 font-bold text-primary">{milestone.year}</span>
              <span className="text-foreground/85">{milestone.text}</span>
            </li>
          ))}
        </ol>

        {person.documents && person.documents.length > 0 && (
          <section className="mt-8">
            <h4 className="flex items-center gap-2 text-xs font-bold tracking-widest text-primary">
              <FileText className="h-4 w-4" />
              ТҮҮХЭН БАРИМТ
            </h4>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {person.documents.map((doc, index) => (
                <button
                  key={doc.caption}
                  type="button"
                  onClick={() => onViewDocument(index)}
                  className="group self-start text-left"
                >
                  <span className="relative block aspect-[3/4] overflow-hidden rounded-lg border border-border bg-muted transition-colors group-hover:border-primary">
                    <Image
                      src={doc.src}
                      alt={doc.caption}
                      fill
                      sizes="(max-width: 640px) 30vw, 200px"
                      placeholder="blur"
                      className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    />
                  </span>
                  <span className="mt-2 block text-xs leading-snug text-muted-foreground group-hover:text-foreground">
                    {doc.caption}
                  </span>
                </button>
              ))}
            </div>
            {person.documentsSource && (
              <p className="mt-3 text-xs text-muted-foreground">
                Баримтын эх сурвалж:{" "}
                <a
                  href={person.documentsSource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-primary"
                >
                  {person.documentsSource.label}
                </a>
              </p>
            )}
          </section>
        )}

        <Sources sources={person.sources} />
      </div>
    </article>
  );
}

/** Баримт бичгийг бүтэн дэлгэцээр томруулж үзэх цонх (намтрын цонхны дээр нээгдэнэ) */
function DocumentViewer({ viewer, onChange }: { viewer: Viewer; onChange: (viewer: Viewer) => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (viewer && !dialog.open) dialog.showModal();
    if (!viewer && dialog.open) dialog.close();
  }, [viewer]);

  const count = viewer?.documents.length ?? 0;
  const show = (index: number) => viewer && onChange({ ...viewer, index: (index + count) % count });
  const current = viewer ? viewer.documents[viewer.index] : null;

  return (
    <dialog
      ref={ref}
      onClose={(e) => e.target === e.currentTarget && onChange(null)}
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      onKeyDown={(e) => {
        if (!viewer) return;
        if (e.key === "ArrowRight") show(viewer.index + 1);
        if (e.key === "ArrowLeft") show(viewer.index - 1);
      }}
      aria-label="Түүхэн баримт"
      className="history-dialog m-auto h-[92vh] w-[min(60rem,calc(100vw-1rem))] max-w-none overflow-visible bg-transparent p-0 backdrop:bg-black/90"
    >
      {current && viewer && (
        <figure className="flex h-full flex-col" onClick={(e) => e.target === e.currentTarget && ref.current?.close()}>
          <div className="relative min-h-0 flex-1">
            <Image src={current.src} alt={current.caption} fill sizes="(max-width: 960px) 100vw, 960px" className="object-contain" />
          </div>
          <figcaption className="mt-3 text-center text-sm text-gray-200">
            {current.caption}
            <span className="ml-2 text-gray-400">
              {viewer.index + 1} / {count}
            </span>
          </figcaption>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Хаах"
            className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white hover:bg-primary hover:text-primary-foreground"
          >
            <X className="h-6 w-6" />
          </button>
          {count > 1 && (
            <>
              <button
                type="button"
                onClick={() => show(viewer.index - 1)}
                aria-label="Өмнөх баримт"
                className="absolute left-0 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-primary hover:text-primary-foreground"
              >
                <ChevronLeft className="h-7 w-7" />
              </button>
              <button
                type="button"
                onClick={() => show(viewer.index + 1)}
                aria-label="Дараагийн баримт"
                className="absolute right-0 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-primary hover:text-primary-foreground"
              >
                <ChevronRight className="h-7 w-7" />
              </button>
            </>
          )}
        </figure>
      )}
    </dialog>
  );
}
