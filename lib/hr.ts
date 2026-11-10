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

/** Нэг л төрлийн үүрэг — хуваарийг 7 хоногоор (Даваа–Ням) гаргаж, өдөр бүрд хүмүүсийг нь сонгоно */
export const DUTY_LABEL = "Харуул хоногийн манаа";

/** Манаанд гарах өдөр энэ цагаас хойш (Улаанбаатарын цагаар) «Тайван хоноорой» мэдэгдэл очно */
export const DUTY_REMINDER_HOUR = 11;
export const DUTY_REMINDER_TEXT = "Та өнөөдөр харуул хоногийн манаанд гарна. Тайван хоноорой!";

export const WEEK_DAYS = 7;

/** Цолын товчлол — бага цолоос ахлах руу. Цолыг зөвхөн эндээс сонгоно. */
export const RANKS = ["энг", "т/ч", "а/т", "д/а", "а/ч", "а/а", "с/а", "т/а", "д/ч", "а/д", "а/х", "х/ч", "д/х", "Хур"] as const;

export const PERSONNEL_LIMITS = { rank: 60, name: 120, position: 120 } as const;
export const ALERT_LIMITS = { title: 120, body: 1000 } as const;

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
  const digits = value.replace(/[\s\-()]/g, "").replace(/^\+?976/, "");
  return /^\d{8}$/.test(digits) ? digits : null;
}

/** "99112233" → "9911 2233" */
export function formatPhone(phone?: string | null): string {
  return phone && /^\d{8}$/.test(phone) ? `${phone.slice(0, 4)} ${phone.slice(4)}` : (phone ?? "");
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };
type PersonnelFields = { rank?: string; name?: string; position?: string; phone?: string };

/**
 * Цол, нэр, албан тушаал, утасны дугаарыг шалгана. partial — зөвхөн ирсэн талбаруудыг (засварт).
 * Цол хоосон эсвэл RANKS-ийн нэг байна; keepRank — жагсаалт гарахаас өмнө бичсэн хуучин цолыг засварт хэвээр үлдээнэ.
 * Утасны дугаар заавал (8 оронтой).
 */
export function parsePersonnel(body: unknown, partial = false, keepRank?: string): Result<PersonnelFields> {
  const b = (body ?? {}) as Record<string, unknown>;
  const out: PersonnelFields = {};
  for (const key of ["rank", "name", "position"] as const) {
    if (b[key] === undefined && partial) continue;
    const value = typeof b[key] === "string" ? b[key].trim() : "";
    if (value.length > PERSONNEL_LIMITS[key]) return { ok: false, error: "Хэт урт утга байна" };
    out[key] = value;
  }
  if (out.name === "" || (!partial && !out.name)) return { ok: false, error: "Нэрийг бичнэ үү" };
  if (out.rank && out.rank !== keepRank && !(RANKS as readonly string[]).includes(out.rank)) {
    return { ok: false, error: "Цолоо жагсаалтаас сонгоно уу" };
  }
  if (b.phone !== undefined || !partial) {
    const phone = normalizePhone(typeof b.phone === "string" ? b.phone : "");
    if (!phone) return { ok: false, error: "Утасны дугаараа бичнэ үү (8 оронтой)" };
    out.phone = phone;
  }
  return { ok: true, value: out };
}
