"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, FileText, X } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { MglHeading } from "@/components/mgl/mgl-heading";
import { UlziiKnot } from "@/components/mgl/mgl-ornaments";
import { useWheelToHorizontal } from "@/components/mgl/mgl-scroller";
import { Medal, Portrait, Sources, type OpenFn } from "@/components/history-parts";
import { mglDigits } from "@/lib/mgl/shared";
import type { HistoryEvent, HistoryLabels, HistoryPerson, UnitAward } from "@/lib/unit-history";

// Ангийн түүхийн хэсгийн монгол бичгийн (босоо) харагдац. Бичвэрүүд серверээс монгол бичгээр ирнэ.
// Босоо бичвэрийн багана зүүнээс баруун тийш урсдаг тул түүхэн замнал хэвтээ, цонхнууд хэвтээ гүйлгэгдэнэ.

/* ---------------------------------- Түүхэн замнал (хэвтээ) ---------------------------------- */

export function TimelineMgl({
  events,
  people,
  labels,
  onOpen,
}: {
  events: HistoryEvent[];
  people: HistoryPerson[];
  labels: HistoryLabels;
  onOpen: OpenFn;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Хэвтээ гүйлгэх тусам шугам зурагдаж, давсан үйл явдлын цэг гэрэлтэнэ
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const items = Array.from(scroller.querySelectorAll<HTMLElement>(".timeline-item"));
    let frame = 0;

    const update = () => {
      frame = 0;
      const progress = Math.min(1, (scroller.scrollLeft + scroller.clientWidth * 0.7) / scroller.scrollWidth);
      scroller.style.setProperty("--progress", progress.toFixed(4));
      const limit = scroller.getBoundingClientRect().left + scroller.clientWidth * 0.7;
      for (const item of items) item.toggleAttribute("data-passed", item.getBoundingClientRect().left < limit);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    scroller.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      scroller.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, []);

  const scrollBy = (direction: number) =>
    scrollerRef.current?.scrollBy({ left: direction * scrollerRef.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <div className="mt-24 flex flex-col gap-8 lg:flex-row">
      <Reveal>
        <MglHeading eyebrow={labels.timelineEyebrow} title={labels.timelineTitle} as="h3" />
      </Reveal>
      <div className="min-w-0 flex-1">
        <div ref={scrollerRef} tabIndex={0} aria-label={labels.timelineTitle} className="mgl-scroll relative pb-4 outline-none">
          <ol className="relative flex w-max flex-row gap-5 px-1 pt-10">
            <li aria-hidden className="absolute left-0 right-0 top-4 h-0.5 bg-border" />
            <li
              aria-hidden
              className="timeline-progress-x absolute left-0 right-0 top-4 h-0.5 origin-left bg-linear-to-r from-primary via-primary to-primary/30"
            />
            {events.map((event, index) => {
              const person = people.find((item) => item.id === event.personId);
              return (
                <li key={event.id} id={event.id} className="timeline-item relative shrink-0 scroll-ml-4">
                  <span
                    aria-hidden
                    className="timeline-dot absolute -top-8 left-5 block h-4 w-4 rounded-full border-2 border-primary bg-background"
                  />
                  <Reveal delay={Math.min(index, 4) * 70}>
                    <button
                      type="button"
                      onClick={() => onOpen(event.id)}
                      className="group flex h-[24rem] flex-col gap-3 rounded-xl border border-border bg-card metallic p-4 text-left transition duration-300 hover:-translate-y-1 hover:border-primary/70 hover:shadow-lg hover:shadow-primary/10"
                    >
                      {event.image ? (
                        <Medal image={event.image} className="h-14 w-14" />
                      ) : (
                        person && <Portrait person={person} size="sm" />
                      )}
                      <span className="flex min-h-0 flex-1 flex-row gap-3">
                        <span className="timeline-year mgl-v text-2xl leading-none">{event.year}</span>
                        <span className="mgl-v line-clamp-3 text-lg leading-snug text-foreground transition-colors group-hover:text-primary">
                          {event.title}
                        </span>
                        <span className="mgl-v line-clamp-4 text-sm leading-relaxed text-muted-foreground">
                          {event.summary}
                        </span>
                        <span className="mgl-v inline-flex items-center gap-1 text-sm text-primary">
                          {labels.more}
                          <ArrowDown className="h-4 w-4 transition-transform group-hover:translate-y-1" />
                        </span>
                      </span>
                    </button>
                  </Reveal>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="←"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground hover:border-primary hover:text-primary"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="→"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground hover:border-primary hover:text-primary"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Түүхэн хүмүүс ---------------------------------- */

export function PeopleMgl({ people, labels, onOpen }: { people: HistoryPerson[]; labels: HistoryLabels; onOpen: OpenFn }) {
  return (
    <div className="mt-24 flex flex-col gap-8 lg:flex-row">
      <Reveal>
        <MglHeading eyebrow={labels.peopleEyebrow} title={labels.peopleTitle} as="h3" />
      </Reveal>
      <div className="grid min-w-0 flex-1 gap-6 md:grid-cols-2">
        {people.map((person, index) => (
          <Reveal key={person.id} delay={index * 120}>
            <button
              id={person.id}
              type="button"
              onClick={() => onOpen(person.id)}
              className="group flex h-full w-full scroll-mt-28 flex-row items-start gap-5 overflow-hidden rounded-2xl border border-border bg-card metallic p-6 text-left transition duration-300 hover:-translate-y-1 hover:border-primary/70 hover:shadow-lg hover:shadow-primary/10"
            >
              <Portrait person={person} />
              <span className="flex h-64 min-w-0 flex-row gap-3">
                <span className="mgl-v text-xs leading-relaxed text-primary">{person.role}</span>
                <span className="mgl-v text-2xl leading-snug text-foreground transition-colors group-hover:text-primary">
                  {person.rank} {person.shortName}
                </span>
                <span className="mgl-v text-sm text-muted-foreground">{person.lifespan}</span>
                <span className="mgl-v line-clamp-3 text-sm leading-relaxed text-foreground/80">{person.tagline}</span>
                <span className="mgl-v inline-flex items-center gap-1 text-sm text-primary">
                  {labels.biography}
                  <ArrowDown className="h-4 w-4 transition-transform group-hover:translate-y-1" />
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

export function AwardsMgl({ awards, labels, onOpen }: { awards: UnitAward[]; labels: HistoryLabels; onOpen: OpenFn }) {
  return (
    <div className="mt-24 flex flex-col gap-8 lg:flex-row">
      <Reveal>
        <MglHeading eyebrow={labels.awardsEyebrow} title={labels.awardsTitle} as="h3" />
      </Reveal>
      <div className="grid min-w-0 flex-1 gap-6 md:grid-cols-2">
        {awards.map((award, index) => (
          <Reveal key={award.eventId} delay={index * 120}>
            <button
              type="button"
              onClick={() => onOpen(award.eventId)}
              className="group flex h-full w-full flex-row items-center gap-5 overflow-hidden rounded-2xl border border-border bg-card metallic p-6 text-left transition duration-300 hover:-translate-y-1 hover:border-primary/70 hover:shadow-lg hover:shadow-primary/10"
            >
              <Medal image={award.image} className="h-28 w-28 sm:h-36 sm:w-36" />
              <span className="flex h-56 min-w-0 flex-row gap-3">
                <span className="mgl-v text-lg text-primary">{award.year}</span>
                <span className="mgl-v text-xl leading-snug text-foreground transition-colors group-hover:text-primary">
                  {award.name}
                </span>
                <span className="mgl-v line-clamp-3 text-sm leading-relaxed text-muted-foreground">{award.reason}</span>
                <span className="mgl-v inline-flex items-center gap-1 text-sm text-primary">
                  {labels.more}
                  <ArrowDown className="h-4 w-4 transition-transform group-hover:translate-y-1" />
                </span>
              </span>
            </button>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------- Дэлгэрэнгүй цонх (босоо) ---------------------------------- */

/** Цонхны толгой: зөвхөн дугаар, хаах товч (монгол бичиг босоо тул гарчиг нь их биед) */
function MglDialogBar({ counter, closeLabel, onClose }: { counter?: string; closeLabel: string; onClose: () => void }) {
  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-border px-5">
      <span className="inline-flex items-center gap-2 text-xs text-primary">
        <UlziiKnot className="h-5 w-5 text-gold" />
        {counter && <span className="mgl-v">{mglDigits(counter)}</span>}
      </span>
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

type EventDetailsMglProps = {
  event: HistoryEvent;
  events: HistoryEvent[];
  people: HistoryPerson[];
  labels: HistoryLabels;
  onOpen: OpenFn;
  onClose: () => void;
};

export function EventDetailsMgl({ event, events, people, labels, onOpen, onClose }: EventDetailsMglProps) {
  const scrollRef = useWheelToHorizontal<HTMLDivElement>();
  const index = events.findIndex((item) => item.id === event.id);
  const previous = events[index - 1];
  const next = events[index + 1];
  const person = people.find((item) => item.id === event.personId);

  return (
    <article className="flex h-full flex-col">
      <MglDialogBar counter={`${index + 1} / ${events.length}`} closeLabel={labels.close} onClose={onClose} />
      <div ref={scrollRef} data-dialog-scroll className="mgl-scroll flex min-h-0 flex-1 flex-row gap-7 p-6 sm:p-8">
        <span className="mgl-v shrink-0 text-xs text-primary">{labels.timelineTitle}</span>
        <p className="mgl-v shrink-0 text-5xl leading-none text-primary">{event.year}</p>
        <h3 id="history-dialog-title" className="mgl-v shrink-0 text-3xl leading-snug text-foreground">
          {event.title}
        </h3>
        {event.image && (
          <figure className="flex shrink-0 flex-col items-center gap-3 self-center">
            <Medal image={event.image} className="h-36 w-36" float />
            {event.image.note && (
              <figcaption className="mgl-v max-h-40 text-xs text-muted-foreground">{event.image.note}</figcaption>
            )}
          </figure>
        )}
        {event.details.map((paragraph) => (
          <p key={paragraph} className="mgl-v shrink-0 text-lg leading-loose text-foreground/90">
            {paragraph}
          </p>
        ))}
        {person && (
          <button
            type="button"
            onClick={() => onOpen(person.id)}
            className="group flex shrink-0 flex-col items-center gap-3 self-start rounded-xl border border-primary/40 bg-primary/5 p-4 transition-colors hover:border-primary"
          >
            <Portrait person={person} size="lg" />
            <span className="flex flex-row gap-2">
              <span className="mgl-v text-xs text-primary">{labels.biographyLabel}</span>
              <span className="mgl-v text-base text-foreground">
                {person.rank} {person.shortName}
              </span>
            </span>
          </button>
        )}
        <Sources sources={event.sources} label={labels.sources} vertical />
        <nav aria-label={labels.timelineTitle} className="flex shrink-0 flex-col justify-between gap-3">
          {previous ? (
            <button
              type="button"
              onClick={() => onOpen(previous.id)}
              className="mgl-v inline-flex items-center gap-2 rounded-md border border-border px-2 py-3 text-sm hover:border-primary hover:text-primary"
            >
              <ArrowUp className="h-4 w-4" />
              {previous.year}
            </button>
          ) : (
            <span />
          )}
          {next && (
            <button
              type="button"
              onClick={() => onOpen(next.id)}
              className="mgl-v inline-flex items-center gap-2 rounded-md border border-border px-2 py-3 text-sm hover:border-primary hover:text-primary"
            >
              {next.year}
              <ArrowDown className="h-4 w-4" />
            </button>
          )}
        </nav>
      </div>
    </article>
  );
}

type PersonDetailsMglProps = {
  person: HistoryPerson;
  labels: HistoryLabels;
  onClose: () => void;
  onViewDocument: (index: number) => void;
};

export function PersonDetailsMgl({ person, labels, onClose, onViewDocument }: PersonDetailsMglProps) {
  const scrollRef = useWheelToHorizontal<HTMLDivElement>();

  return (
    <article className="flex h-full flex-col">
      <MglDialogBar closeLabel={labels.close} onClose={onClose} />
      <div ref={scrollRef} data-dialog-scroll className="mgl-scroll flex min-h-0 flex-1 flex-row gap-7 p-6 sm:p-8">
        <div className="group shrink-0 self-start">
          <Portrait person={person} size="lg" />
        </div>
        <span className="mgl-v shrink-0 text-sm text-primary">{person.role}</span>
        <span className="mgl-v shrink-0 text-base text-primary">{person.rank}</span>
        <h3 id="history-dialog-title" className="mgl-v shrink-0 text-3xl leading-snug text-foreground">
          {person.name}
        </h3>
        <span className="mgl-v shrink-0 text-sm text-muted-foreground">{person.lifespan}</span>

        <dl className="flex shrink-0 flex-row gap-3">
          {person.facts.map((fact) => (
            <div key={fact.label} className="flex flex-row gap-2 rounded-lg border border-border bg-background/60 p-3">
              <dt className="mgl-v text-xs text-muted-foreground">{fact.label}</dt>
              <dd className="mgl-v text-sm text-foreground">{fact.value}</dd>
            </div>
          ))}
        </dl>

        {person.bio.map((paragraph) => (
          <p key={paragraph} className="mgl-v shrink-0 text-lg leading-loose text-foreground/90">
            {paragraph}
          </p>
        ))}

        <section className="flex shrink-0 flex-row gap-4 border-l border-border pl-5">
          <h4 className="mgl-v text-sm text-primary">{labels.chronology}</h4>
          <ol className="flex flex-row gap-4">
            {person.milestones.map((milestone) => (
              <li key={milestone.year + milestone.text} className="flex flex-row gap-1">
                <span className="mgl-v text-base text-primary">{milestone.year}</span>
                <span className="mgl-v text-sm text-foreground/85">{milestone.text}</span>
              </li>
            ))}
          </ol>
        </section>

        {person.documents && person.documents.length > 0 && (
          <section className="flex shrink-0 flex-row gap-4 border-l border-border pl-5">
            <h4 className="mgl-v inline-flex items-center gap-2 text-sm text-primary">
              <FileText className="h-4 w-4" />
              {labels.documents}
            </h4>
            {person.documents.map((doc, index) => (
              <button
                key={doc.caption}
                type="button"
                onClick={() => onViewDocument(index)}
                className="group flex flex-row items-start gap-2 text-left"
              >
                <span className="relative block aspect-[3/4] w-36 overflow-hidden rounded-lg border border-border bg-muted transition-colors group-hover:border-primary">
                  <Image
                    src={doc.src}
                    alt={doc.caption}
                    fill
                    sizes="144px"
                    placeholder="blur"
                    className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  />
                </span>
                <span className="mgl-v max-h-48 text-xs leading-snug text-muted-foreground group-hover:text-foreground">
                  {doc.caption}
                </span>
              </button>
            ))}
            {person.documentsSource && (
              <a
                href={person.documentsSource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mgl-v text-xs text-muted-foreground underline hover:text-primary"
              >
                {labels.documentsSource} {person.documentsSource.label}
              </a>
            )}
          </section>
        )}

        <Sources sources={person.sources} label={labels.sources} vertical />
      </div>
    </article>
  );
}
