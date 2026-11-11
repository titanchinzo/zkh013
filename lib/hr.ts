// Хүний нөөц: алба хаагчдын ирц, харуул хоногийн манаа — server болон client аль алинд ажиллана

export const ATTENDANCE_LABELS = {
  present: "Ирсэн",
  leave: "Чөлөөтэй",
  sick: "Өвчтэй",
  trip: "Томилолттой",
  vacation: "Ээлжийн амралттай",
  absent: "Тасалсан",
} as const;

export type AttendanceStatus = keyof typeof ATTENDANCE_LABELS;
export const ATTENDANCE_STATUSES = Object.keys(ATTENDANCE_LABELS) as AttendanceStatus[];

/** Ирцийн хуанлийн нүдэнд багтах богино нэр */
export const ATTENDANCE_SHORT: Record<AttendanceStatus, string> = {
  present: "Ирсэн",
  leave: "Чөлөө",
  sick: "Өвчтэй",
  trip: "Томилолт",
  vacation: "Амралт",
  absent: "Тасалсан",
};

/** Нэг л төрлийн үүрэг — хуваарийг 7 хоногоор (Даваа–Ням) гаргаж, өдөр бүрд хүмүүсийг нь сонгоно */
export const DUTY_LABEL = "Харуул хоногийн манаа";

/** Манаанд гарах өдөр энэ цагаас хойш (Улаанбаатарын цагаар) «Тайван хоноорой» мэдэгдэл очно */
export const DUTY_REMINDER_HOUR = 11;
export const DUTY_REMINDER_TEXT = "Та өнөөдөр харуул хоногийн манаанд гарна. Тайван хоноорой!";

export const WEEK_DAYS = 7;

/** Цолын товчлол — бага цолоос ахлах руу. Цолыг зөвхөн эндээс сонгоно. */
export const RANKS = ["энг", "т/ч", "а/т", "д/а", "а/ч", "а/а", "с/а", "т/а", "д/ч", "а/д", "а/х", "х/ч", "д/х", "Хур"] as const;

export const PERSONNEL_LIMITS = { rank: 60, name: 120, position: 120, group: 120 } as const;

/** Цолын ахлах эрэмбэ: Хур хамгийн их, энг хамгийн бага; жагсаалтад байхгүй цол -1 */
export function rankSeniority(rank: string): number {
  return (RANKS as readonly string[]).indexOf(rank);
}

// Excel, PDF-ээс хуулахад кирилл үгэнд орж ирдэг латин ижил дүрстэй үсэг
const LOOKALIKES: Record<string, string> = {
  A: "А", B: "В", C: "С", E: "Е", H: "Н", K: "К", M: "М", O: "О", P: "Р", T: "Т", X: "Х",
  a: "а", c: "с", e: "е", k: "к", o: "о", p: "р", x: "х", y: "у",
};

/** Кирилл бичвэр дэх латин ижил дүрстэй үсгийг (с/a, Mустафа г.м) кирилл болгоно */
export function fixLookalikes(text: string): string {
  return /[А-Яа-яЁёӨөҮү]/.test(text) ? text.replace(/[ABCEHKMOPTXacekopxy]/g, (ch) => LOOKALIKES[ch] ?? ch) : text;
}

/** Цолын бичлэгийг жагсаалтын хэлбэрт оруулна ("хур" → "Хур", латин "с/a" → "с/а"); танигдахгүй бол null */
export function normalizeRank(value: string): string | null {
  const v = fixLookalikes(value).replace(/\s+/g, "").toLowerCase();
  return (RANKS as readonly string[]).find((r) => r.toLowerCase() === v) ?? null;
}

/**
 * Нэг нүдэнд бичсэн утасны дугааруудыг салгана: "88112233, 99112233", "9911 2233", "+976 88112233".
 * Excel мянгатын таслалаар эвдсэн "9,811,738,699,633,330" (16 орон) → 2 дугаар. invalid — танигдаагүй хэсэг.
 */
export function parsePhones(text: string): { phones: string[]; invalid: string[]; repaired?: string } {
  let value = text.trim();
  const repaired = /^\d{1,3}(,\d{3})+$/.test(value) ? value : undefined;
  if (repaired) value = value.replace(/,/g, "");
  const phones: string[] = [];
  const invalid: string[] = [];
  for (const part of value.split(/[,;/]+/)) {
    const raw = part.trim();
    if (!raw || /^[-—–]+$/.test(raw)) continue;
    let digits = raw.replace(/\D/g, "");
    if (/^976\d{8}$/.test(digits)) digits = digits.slice(3);
    if (digits.length >= 8 && digits.length % 8 === 0 && /^[\d\s+()-]+$/.test(raw)) {
      for (let i = 0; i < digits.length; i += 8) phones.push(digits.slice(i, i + 8));
    } else invalid.push(raw);
  }
  return { phones: [...new Set(phones)], invalid, ...(repaired && phones.length ? { repaired } : {}) };
}
export const ALERT_LIMITS = { title: 120, body: 1000 } as const;
/** Зарлан мэдээллийн дуусах цаг хамгийн хол нь одооноос хойш ийм хоног */
export const ALERT_MAX_DAYS = 365;

const HOUR_MS = 3_600_000;
/** Зарлан мэдээллийн маягт дээрх хугацааны товчнууд — эхлэх цагаас (хоосон бол одооноос) хойш */
export const ALERT_DURATIONS = [
  { label: "1 цаг", ms: HOUR_MS },
  { label: "3 цаг", ms: 3 * HOUR_MS },
  { label: "1 хоног", ms: 24 * HOUR_MS },
  { label: "3 хоног", ms: 72 * HOUR_MS },
  { label: "7 хоног", ms: 168 * HOUR_MS },
  { label: "30 хоног", ms: 720 * HOUR_MS },
] as const;

const UB_TZ = "Asia/Ulaanbaatar";
const WEEKDAYS = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];

/** Улаанбаатарын цагаар өнөөдрийн огноо: "YYYY-MM-DD" */
export function todayUb(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: UB_TZ }).format(now);
}

/** Улаанбаатарын цагаар одоо хэдэн цаг (0–23) */
export function hourUb(now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: UB_TZ, hour: "2-digit", hourCycle: "h23" }).format(now));
}

const UB_DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: UB_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function ubParts(value: string | Date): Record<string, string> {
  const parts: Record<string, string> = {};
  for (const p of UB_DATE_TIME.formatToParts(new Date(value))) parts[p.type] = p.value;
  return parts;
}

/** "11 сарын 12, 09:00" — Улаанбаатарын цагаар */
export function formatDateTime(value: string | Date): string {
  const p = ubParts(value);
  return `${Number(p.month)} сарын ${Number(p.day)}, ${p.hour}:${p.minute}`;
}

/** <input type="datetime-local">-ийн утга, Улаанбаатарын цагаар: "2026-11-12T09:00" */
export function toUbInput(value: string | Date): string {
  const p = ubParts(value);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** datetime-local-ийн утгыг Улаанбаатарын цагаар (UTC+8, зуны цаг хэрэглэдэггүй) уншина — компьютерийн цагийн бүсээс үл хамаарна */
export function fromUbInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return null;
  const date = new Date(`${value.length === 16 ? `${value}:00` : value}+08:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Хуанлийн толгой: Даваа … Ням */
export const WEEKDAY_SHORT = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"] as const;

/** Даваа = 0 … Ням = 6 */
export function weekdayIndex(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/** "2026-11" */
export function isMonthKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function addMonths(month: string, months: number): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m - 1 + months, 1)).toISOString().slice(0, 7);
}

/** Тухайн сарын бүх өдөр: ["2026-11-01", …, "2026-11-30"] */
export function monthDays(month: string): string[] {
  const [year, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

/** "2026 оны 11 сар" */
export function formatMonth(month: string): string {
  return `${month.slice(0, 4)} оны ${Number(month.slice(5))} сар`;
}

/** Тэр өдрийг агуулсан 7 хоногийн Даваа гараг */
export function weekStart(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((day + 6) % 7));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** "өнөөдөр", "маргааш", "нөгөөдөр", "3 хоногийн дараа" */
export function relativeDay(date: string, today = todayUb()): string {
  const n = daysBetween(today, date);
  if (n === 0) return "өнөөдөр";
  if (n === 1) return "маргааш";
  if (n === 2) return "нөгөөдөр";
  return n > 0 ? `${n} хоногийн дараа` : `${-n} хоногийн өмнө`;
}

/** "11 сарын 12, Пүрэв" */
export function formatDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCMonth() + 1} сарын ${d.getUTCDate()}, ${WEEKDAYS[d.getUTCDay()]}`;
}

/** "11 сарын 9 – 11 сарын 15" */
export function formatWeek(start: string): string {
  const short = (date: string) => {
    const d = new Date(`${date}T00:00:00Z`);
    return `${d.getUTCMonth() + 1} сарын ${d.getUTCDate()}`;
  };
  return `${short(start)} – ${short(addDays(start, WEEK_DAYS - 1))}`;
}

export function personnelLabel(p: { rank?: string | null; name: string }) {
  return p.rank ? `${p.rank} ${p.name}` : p.name;
}

/** "9911 2233", "+976 9911-2233" → "99112233"; Монголын 8 оронтой дугаар биш бол null */
export function normalizePhone(value: string): string | null {
  let digits = value.replace(/[\s\-()]/g, "").replace(/^\+/, "");
  // 976-аар эхэлсэн 8 оронтой дугаарыг тасдахгүй — зөвхөн +976 улсын кодыг авна
  if (/^976\d{8}$/.test(digits)) digits = digits.slice(3);
  return /^\d{8}$/.test(digits) ? digits : null;
}

/** "99112233" → "9911 2233" */
export function formatPhone(phone?: string | null): string {
  return phone && /^\d{8}$/.test(phone) ? `${phone.slice(0, 4)} ${phone.slice(4)}` : (phone ?? "");
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };
type PersonnelFields = {
  rank?: string;
  name?: string;
  position?: string;
  phone?: string;
  group?: string;
  extraPhones?: string[];
  emergencyPhone?: string;
};
type PersonnelOptions = {
  /** Засварт: зөвхөн ирсэн талбаруудыг шалгана */
  partial?: boolean;
  /** Жагсаалт гарахаас өмнө бичсэн хуучин цолыг засварт хэвээр үлдээнэ */
  keepRank?: string;
  /** Дугааргүй бүртгэлийг (жагсаалтаас оруулсан г.м) дугааргүйгээр засаж болно */
  phoneOptional?: boolean;
  /** Хүний нөөцийн талбарууд — бүлэг, бусад дугаар, «Шаардлагатай үед» (аппаас өөрчлөхгүй) */
  hr?: boolean;
};
type AlertFields = { title: string; body: string; startsAt: Date; endsAt: Date };

/**
 * Зарлан мэдээллийг шалгана: гарчиг (заавал), дэлгэрэнгүй, эхлэх (хоосон бол одоо), дуусах (заавал) — огноо нь ISO
 * хэлбэрээр. Эхлэх цаг болоход утсанд мэдэгдэл очиж харагдана, дуусах цаг өнгөрмөгц автоматаар устна.
 */
export function parseAlert(body: unknown, now = new Date()): Result<AlertFields> {
  const b = (body ?? {}) as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim() : "";
  const text = typeof b.body === "string" ? b.body.trim() : "";
  if (!title) return { ok: false, error: "Гарчгийг бичнэ үү" };
  if (title.length > ALERT_LIMITS.title || text.length > ALERT_LIMITS.body) return { ok: false, error: "Хэт урт байна" };

  const date = (value: unknown) => (typeof value === "string" && value ? new Date(value) : null);
  const startsAt = date(b.startsAt) ?? now;
  const endsAt = date(b.endsAt);
  if (Number.isNaN(startsAt.getTime())) return { ok: false, error: "Эхлэх цаг буруу байна" };
  if (!endsAt || Number.isNaN(endsAt.getTime())) return { ok: false, error: "Дуусах хугацааг сонгоно уу" };
  if (endsAt.getTime() <= startsAt.getTime()) return { ok: false, error: "Дуусах цаг эхлэх цагаас хойш байх ёстой" };
  if (endsAt.getTime() <= now.getTime()) return { ok: false, error: "Дуусах цаг аль хэдийн өнгөрсөн байна" };
  if (endsAt.getTime() - now.getTime() > ALERT_MAX_DAYS * 86_400_000) {
    return { ok: false, error: `Дуусах цаг хэт хол байна (одооноос ${ALERT_MAX_DAYS} хоногийн дотор)` };
  }
  return { ok: true, value: { title, body: text, startsAt, endsAt } };
}

/**
 * Цол, нэр, албан тушаал, утасны дугаарыг шалгана (хүний нөөцөд мөн бүлэг, бусад дугаар, «Шаардлагатай үед»).
 * Цол хоосон эсвэл RANKS-ийн нэг байна. Утасны дугаар заавал (8 оронтой) — phoneOptional бол хоосон байж болно.
 */
export function parsePersonnel(body: unknown, options: PersonnelOptions = {}): Result<PersonnelFields> {
  const { partial = false, keepRank, phoneOptional = false, hr = false } = options;
  const b = (body ?? {}) as Record<string, unknown>;
  const out: PersonnelFields = {};
  for (const key of hr ? (["rank", "name", "position", "group"] as const) : (["rank", "name", "position"] as const)) {
    if (b[key] === undefined && partial) continue;
    const value = typeof b[key] === "string" ? b[key].trim().replace(/\s+/g, " ") : "";
    if (value.length > PERSONNEL_LIMITS[key]) return { ok: false, error: "Хэт урт утга байна" };
    out[key] = value;
  }
  if (out.name === "" || (!partial && !out.name)) return { ok: false, error: "Нэрийг бичнэ үү" };
  if (out.rank && out.rank !== keepRank && !(RANKS as readonly string[]).includes(out.rank)) {
    return { ok: false, error: "Цолоо жагсаалтаас сонгоно уу" };
  }
  if (b.phone !== undefined || !partial) {
    const raw = typeof b.phone === "string" ? b.phone.trim() : "";
    const phone = normalizePhone(raw);
    if (phone) out.phone = phone;
    else if (!raw && phoneOptional) out.phone = "";
    else return { ok: false, error: "Утасны дугаараа бичнэ үү (8 оронтой)" };
  }
  if (hr && b.extraPhones !== undefined) {
    const list = Array.isArray(b.extraPhones) ? b.extraPhones.join(",") : typeof b.extraPhones === "string" ? b.extraPhones : "";
    const { phones, invalid } = parsePhones(list);
    if (invalid.length) return { ok: false, error: `Бусад дугаар буруу: ${invalid.join(", ")} (8 оронтой)` };
    out.extraPhones = phones.filter((p) => p !== out.phone).slice(0, 5);
  }
  if (hr && b.emergencyPhone !== undefined) {
    const raw = typeof b.emergencyPhone === "string" ? b.emergencyPhone.trim() : "";
    const phone = normalizePhone(raw);
    if (raw && !phone) return { ok: false, error: "«Шаардлагатай үед» дугаар буруу (8 оронтой)" };
    out.emergencyPhone = phone ?? "";
  }
  return { ok: true, value: out };
}

/** "Б.Болд" → { initial: "б", given: "болд" }; "Батын Болд" → { initial: "б", given: "болд" } */
function nameParts(name: string) {
  const clean = fixLookalikes(name).toLowerCase().replace(/\s+/g, " ").trim();
  const dotted = clean.match(/^(\p{L})\.\s*(.+)$/u);
  if (dotted) return { initial: dotted[1], given: dotted[2].replace(/\s+/g, "") };
  const words = clean.split(" ");
  return words.length > 1 ? { initial: words[0].charAt(0), given: words[words.length - 1] } : { initial: "", given: clean };
}

/** Нэг хүний нэр эсэх: нэр нь ижил, эцгийн нэрийн эхний үсэг (аль алинд байвал) ижил — "Б.Болд" ≈ "Батын Болд" */
export function sameName(a: string, b: string): boolean {
  const x = nameParts(a);
  const y = nameParts(b);
  return Boolean(x.given) && x.given === y.given && (!x.initial || !y.initial || x.initial === y.initial);
}

/** Бүлгийн дараалал → цол (ахлахаас) → нэрээр эрэмбэлэх; бүлэггүй хүмүүс төгсгөлд */
export function comparePersonnel(groups: readonly string[]) {
  const index = new Map(groups.map((g, i) => [g, i]));
  const at = (group?: string) => (group ? (index.get(group) ?? groups.length) : groups.length + 1);
  return (a: { group?: string; rank: string; name: string }, b: { group?: string; rank: string; name: string }) =>
    at(a.group) - at(b.group) || rankSeniority(b.rank) - rankSeniority(a.rank) || a.name.localeCompare(b.name, "mn");
}
