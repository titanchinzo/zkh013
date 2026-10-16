import "server-only";
import type { Translate } from "@/lib/mgl/server";
import {
  HISTORY_EVENTS,
  HISTORY_LABELS,
  HISTORY_PEOPLE,
  UNIT_AWARDS,
  type HistoryImage,
  type HistoryLabels,
  type Source,
} from "@/lib/unit-history";

const image = (t: Translate, value: HistoryImage): HistoryImage => ({
  ...value,
  alt: t(value.alt),
  note: value.note ? t(value.note) : undefined,
});
const sources = (t: Translate, list: Source[]) => list.map((source) => ({ ...source, label: t(source.label) }));

/** Ангийн түүхийн бүх бичвэрийг сонгосон горимоор (MN бол хэвээр, MGL бол монгол бичгээр) */
export function translateHistory(t: Translate) {
  const events = HISTORY_EVENTS.map((event) => ({
    ...event,
    year: t(event.year),
    title: t(event.title),
    summary: t(event.summary),
    details: event.details.map(t),
    image: event.image ? image(t, event.image) : undefined,
    sources: sources(t, event.sources),
  }));

  const people = HISTORY_PEOPLE.map((person) => ({
    ...person,
    name: t(person.name),
    shortName: t(person.shortName),
    photo: image(t, person.photo),
    rank: t(person.rank),
    lifespan: t(person.lifespan),
    role: t(person.role),
    tagline: t(person.tagline),
    facts: person.facts.map((fact) => ({ label: t(fact.label), value: t(fact.value) })),
    bio: person.bio.map(t),
    milestones: person.milestones.map((milestone) => ({ year: t(milestone.year), text: t(milestone.text) })),
    documents: person.documents?.map((doc) => ({ ...doc, caption: t(doc.caption) })),
    documentsSource: person.documentsSource
      ? { ...person.documentsSource, label: t(person.documentsSource.label) }
      : undefined,
    sources: sources(t, person.sources),
  }));

  const awards = UNIT_AWARDS.map((award) => ({
    ...award,
    year: t(award.year),
    name: t(award.name),
    reason: t(award.reason),
    image: image(t, award.image),
  }));

  const labels = Object.fromEntries(
    Object.entries(HISTORY_LABELS).map(([key, value]) => [key, t(value)])
  ) as HistoryLabels;

  return { events, people, awards, labels };
}
