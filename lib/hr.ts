// Хүний нөөц: алба хаагчдын ирц, харуул, манаа — server болон client аль алинд ажиллана

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

export const DUTY_LABELS = { guard: "7 хоногийн харуул", watch: "Хоногийн манаа" } as const;
export type Duty = keyof typeof DUTY_LABELS;

/** Харуулыг нэг дор оноох хоногийн тоо */
export const GUARD_DAYS = 7;

/** Цолын товчлол — бага цолоос ахлах руу. Цолыг зөвхөн эндээс сонгоно. */
export const RANKS = ["энг", "т/ч", "а/т", "д/а", "а/ч", "а/а", "с/а", "т/а", "д/ч", "а/д", "а/х", "х/ч", "д/х", "Хур"] as const;

export const PERSONNEL_LIMITS = { rank: 60, name: 120, position: 120 } as const;
export const ALERT_LIMITS = { title: 120, body: 1000 } as const;

const UB_TZ = "Asia/Ulaanbaatar";
const WEEKDAYS = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];

/** Улаанбаатарын цагаар өнөөдрийн огноо: "YYYY-MM-DD" */
export function todayUb(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: UB_TZ }).format(new Date());
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

/** "11 сарын 12, Пүрэв" */
export function formatDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCMonth() + 1} сарын ${d.getUTCDate()}, ${WEEKDAYS[d.getUTCDay()]}`;
}

export function personnelLabel(p: { rank?: string | null; name: string }) {
  return p.rank ? `${p.rank} ${p.name}` : p.name;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };
type PersonnelFields = { rank?: string; name?: string; position?: string };

/**
 * Цол, нэр, албан тушаалыг шалгана. partial — зөвхөн ирсэн талбаруудыг (засварт).
 * Цол хоосон эсвэл RANKS-ийн нэг байна; keepRank — жагсаалт гарахаас өмнө бичсэн хуучин цолыг засварт хэвээр үлдээнэ.
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
  return { ok: true, value: out };
}
