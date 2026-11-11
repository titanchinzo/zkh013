// Алба хаагчдын жагсаалтыг (ангийн утасны жагсаалт г.м) бүлгээр нь уншиж бүртгэх — server болон client аль алинд.
// Мөр бүр: [д/д] Цол Нэр «Өөрийн дугаар» «Шаардлагатай үед». Ганц нүдтэй мөр нь бүлгийн нэр (алба, тасаг, рот…).
import { PERSONNEL_LIMITS, fixLookalikes, normalizeRank, parsePhones, sameName } from "@/lib/hr";

export type RosterRow = {
  line: number;
  group: string;
  rank: string;
  name: string;
  /** Нэрний ард /…/ дотор бичсэн тэмдэглэл (хими, касс г.м) — албан тушаал болгоно */
  position: string;
  /** Өөрийн дугаарууд — эхнийх нь үндсэн */
  phones: string[];
  emergencyPhone: string;
  warnings: string[];
};

export type ExistingPerson = {
  _id: string;
  rank: string;
  name: string;
  position: string;
  phone?: string;
  extraPhones?: string[];
  emergencyPhone?: string;
  group?: string;
  active: boolean;
};

export type PlannedRow = RosterRow & {
  action: "create" | "update" | "same";
  match?: { id: string; label: string };
  changes: string[];
};

export const IMPORT_LIMITS = { chars: 500_000, rows: 3000 } as const;

/** Мөрийг нүднүүдэд хуваана — Excel-ээс хуулбал таб, CSV бол "…" доторх тусгаарлагчийг хүндэтгэнэ */
function splitCells(line: string, delimiter: string): string[] {
  if (delimiter === "\t") return line.split("\t").map(unquote);
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      cells.push(cell);
      cell = "";
    } else cell += ch;
  }
  cells.push(cell);
  return cells.map((c) => c.trim());
}

function unquote(cell: string) {
  const c = cell.trim();
  return c.length >= 2 && c.startsWith('"') && c.endsWith('"') ? c.slice(1, -1).replace(/""/g, '"').trim() : c;
}

/** "ХОЛБООНЫ БАТАЛЬОН" → "Холбооны батальон", "Захирагч,орлогч нар" → "Захирагч, орлогч нар", "рот -1" → "рот-1" */
export function cleanGroupName(value: string): string {
  let name = fixLookalikes(value).replace(/\s+/g, " ").trim();
  name = name.replace(/\s*,\s*/g, ", ").replace(/\s+-\s*(\d)/g, "-$1");
  const letters = name.replace(/[^А-Яа-яЁёӨөҮүA-Za-z]/g, "");
  if (letters.length > 3 && letters === letters.toUpperCase()) name = name.charAt(0) + name.slice(1).toLowerCase();
  return name.slice(0, PERSONNEL_LIMITS.group);
}

/** "О. Энхцэцэг /касс/" → { name: "О.Энхцэцэг", note: "касс" } */
function cleanName(value: string): { name: string; note: string } {
  let note = "";
  const name = fixLookalikes(value)
    .replace(/\/([^/]*)\/?/g, (_, inner: string) => {
      note = inner.trim();
      return " ";
    })
    .replace(/\s+/g, " ")
    .replace(/^(\p{L})\.\s+/u, "$1.")
    .trim();
  return { name: name.slice(0, PERSONNEL_LIMITS.name), note: note.slice(0, PERSONNEL_LIMITS.position) };
}

const HEADER = /^(д\/д|№|цол|нэр|овог,? нэр|өөрийн дугаар|шаардлагатай үед)$/i;
// Танигдаагүй цолын товчлол ("а/х" маягийн) — нэрийг цол гэж андуурахгүйн тулд зөвхөн налуу зураастай
const RANK_LIKE = /^[а-яөүё]{1,3}\/[а-яөүё]{1,3}$/i;

/** Жагсаалтын бичвэрийг мөр бүрээр уншина: бүлгүүд (дарааллаараа) ба хүмүүс */
export function parseRoster(text: string): { rows: RosterRow[]; groups: string[] } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const delimiter = text.includes("\t") ? "\t" : (text.match(/;/g)?.length ?? 0) > (text.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: RosterRow[] = [];
  const groups: string[] = [];
  let group = "";

  lines.forEach((line, index) => {
    const cells = splitCells(line, delimiter);
    const filled = cells.filter(Boolean);
    if (!filled.length || filled.some((c) => HEADER.test(c))) return;

    if (filled.length === 1 && !/^\d+$/.test(filled[0]) && !normalizeRank(filled[0])) {
      group = cleanGroupName(filled[0]);
      if (group && !groups.includes(group)) groups.push(group);
      return;
    }

    const warnings: string[] = [];
    let i = cells.findIndex(Boolean);
    if (/^\d+\.?$/.test(cells[i])) i++;
    const rank = normalizeRank(cells[i] ?? "") ?? "";
    if (rank) i++;
    else if (RANK_LIKE.test(cells[i] ?? "") && cells[i + 1]) {
      warnings.push(`Цол танигдсангүй: «${cells[i]}»`);
      i++;
    }
    const { name, note } = cleanName(cells[i] ?? "");
    if (!name) return;
    if (!rank && !warnings.length) warnings.push("Цолгүй");

    const own = parsePhones(cells[i + 1] ?? "");
    const emergency = parsePhones(cells[i + 2] ?? "");
    if (own.invalid.length) warnings.push(`Дугаар танигдсангүй: ${own.invalid.join(", ")}`);
    if (own.repaired) warnings.push(`Excel эвдсэн дугаарыг сэргээв: ${own.repaired} → ${own.phones.join(", ")} — шалгана уу`);
    if (emergency.invalid.length) warnings.push(`«Шаардлагатай үед» дугаар танигдсангүй: ${emergency.invalid.join(", ")}`);
    if (!own.phones.length) warnings.push("Утасны дугааргүй");
    if (emergency.phones.length > 1) warnings.push(`«Шаардлагатай үед» эхний дугаарыг авлаа: ${emergency.phones.join(", ")}`);

    rows.push({
      line: index + 1,
      group,
      rank,
      name,
      position: note,
      phones: own.phones.slice(0, 6),
      emergencyPhone: emergency.phones[0] ?? "",
      warnings,
    });
  });

  // Жагсаалтад нэг нэр хэд хэдэн удаа — нэг хүн хоёр бүлэгт бичигдсэн байж магадгүй
  const key = (r: RosterRow) => `${r.rank}|${nameKey(r.name)}`;
  const seen = new Map<string, number>();
  for (const r of rows) seen.set(key(r), (seen.get(key(r)) ?? 0) + 1);
  for (const r of rows) {
    const n = seen.get(key(r))!;
    if (n > 1) r.warnings.push(`Жагсаалтад ${n} удаа бичигдсэн — нэг хүн бол илүүг нь дараа нь устгана уу`);
  }
  // Өөр хүнтэй ижил өөрийн дугаар — дундын утас эсвэл нэг хүн хоёр газар бичигдсэн
  const byPhone = new Map<string, RosterRow[]>();
  for (const r of rows) for (const phone of r.phones) byPhone.set(phone, [...(byPhone.get(phone) ?? []), r]);
  for (const r of rows) {
    const others = [...new Set(r.phones.flatMap((phone) => byPhone.get(phone) ?? []))].filter((o) => o !== r);
    if (others.length) r.warnings.push(`Өөрийн дугаар нь ${others.map((o) => `${label(o)} (${o.line}-р мөр)`).join(", ")}-тай ижил`);
  }
  return { rows, groups };
}

const nameKey = (name: string) => fixLookalikes(name).toLowerCase().replace(/\s+/g, "");

const label = (p: { rank: string; name: string }) => (p.rank ? `${p.rank} ${p.name}` : p.name);

/**
 * Өмнөх бүртгэлтэй тааруулна: өөрийн дугаар (үндсэн эсвэл бусад) таарвал тэр хүн; хэд хэдэн хүнтэй таарвал нэрээр нь
 * ялгана. Дугаар таараагүй бол — нэр нь ганцхан хүнтэй таарч (sameName), аль нэгнийх нь дугаар хоосон бол тэр хүн.
 * Нэг бүртгэл нэг л мөртэй тааруулна (жагсаалтад давхардсан хүн 2 бүртгэл болно).
 */
export function planImport(rows: RosterRow[], existing: ExistingPerson[]): PlannedRow[] {
  const byPhone = new Map<string, ExistingPerson[]>();
  for (const p of existing) {
    for (const phone of new Set([p.phone, ...(p.extraPhones ?? [])].filter(Boolean) as string[])) {
      byPhone.set(phone, [...(byPhone.get(phone) ?? []), p]);
    }
  }
  const claimed = new Set<string>();

  // Хэд хэдэн хүнтэй таарвал: нэр нь яг ижил → нэр нь төстэй ("Б.Болд" ≈ "Батын Болд") → ижил бүлэгт
  const pick = (row: RosterRow, list: ExistingPerson[]) => {
    for (const narrowed of [
      list.filter((p) => nameKey(p.name) === nameKey(row.name)),
      list.filter((p) => sameName(p.name, row.name)),
    ]) {
      if (narrowed.length === 1) return narrowed[0];
      const sameGroup = narrowed.filter((p) => (p.group ?? "") === row.group);
      if (narrowed.length > 1 && sameGroup.length === 1) return sameGroup[0];
    }
    return undefined;
  };

  return rows.map((row) => {
    const free = (list: ExistingPerson[]) => [...new Set(list)].filter((p) => !claimed.has(p._id));
    const phoneHits = free(row.phones.flatMap((phone) => byPhone.get(phone) ?? []));
    let match: ExistingPerson | undefined;
    if (phoneHits.length === 1) match = phoneHits[0];
    else if (phoneHits.length > 1) match = pick(row, phoneHits);
    else {
      // Дугаар нь таараагүй — нэрээр нь, гэхдээ аль нэгнийх нь дугаар хоосон үед л (өөр дугаартай бол өөр хүн байж болно)
      const named = pick(row, free(existing));
      if (named && (!row.phones.length || !named.phone)) match = named;
    }
    if (!match) return { ...row, action: "create" as const, changes: [] };

    claimed.add(match._id);
    const changes: string[] = [];
    const ownNow = [match.phone, ...(match.extraPhones ?? [])].filter(Boolean).join(", ");
    if (row.group && row.group !== (match.group ?? "")) changes.push(match.group ? `бүлэг: ${match.group} → ${row.group}` : `бүлэг: ${row.group}`);
    if (row.rank && row.rank !== match.rank) changes.push(`цол: ${match.rank || "—"} → ${row.rank}`);
    if (row.phones.length && row.phones.join(", ") !== ownNow) changes.push(`дугаар: ${ownNow || "—"} → ${row.phones.join(", ")}`);
    if (row.emergencyPhone && row.emergencyPhone !== (match.emergencyPhone ?? "")) changes.push(`шаардлагатай үед: ${row.emergencyPhone}`);
    if (row.position && !match.position) changes.push(`албан тушаал: ${row.position}`);
    if (!match.active) changes.push("идэвхжүүлнэ");
    return {
      ...row,
      action: changes.length ? ("update" as const) : ("same" as const),
      match: { id: match._id, label: label(match) },
      changes,
    };
  });
}
