// Утсан дээрх аппын чат — сервер болон утасны (client) аль алинд хэрэглэгдэх тогтмолууд, туслах функцууд.

export const CHAT_LIMITS = { text: 2000 } as const;
// Сервер зурвасыг хүлээн авагч уншмагц устгадаг; огт нээгээгүй зурвас ч энэ хугацааны дараа устна
export const CHAT_TTL_DAYS = 30;

// Хүн аппаа нээлттэй байх үед утас сервер рүү тогтмол хандана (чатын жагсаалт 10 с, нүүр хуудас 15 с,
// чат дотор 2.5 с). Сүүлийн 45 секундэд хандсан бол «Идэвхтэй» гэж харуулна.
export const ONLINE_MS = 45_000;
export const POLL_MS = { home: 15_000, list: 10_000, conversation: 2_500 } as const;

// Чатаар илгээх файл: 2 ГБ хүртэл, хүлээн авагч татаж авмагц серверээс устна. Татаагүй файл CHAT_FILE_DAYS хоногийн
// дараа устна. Нэг хүний хүлээгдэж буй (татагдаагүй) файлын тоо, нийт хэмжээ хязгаартай — серверийн диск дүүрэхгүй.
export const CHAT_FILE = { maxBytes: 2 * 1024 ** 3, days: 7, maxPending: 10, maxPendingBytes: 10 * 1024 ** 3 } as const;
// «Уншаад 2 минутад устах» горим: хүлээн авагч уншсанаас хойш энэ хугацаанд хоёр утаснаас устна
export const EPHEMERAL_MS = 2 * 60_000;

export type ChatFileMeta = { id: string; name: string; size: number; type: string };

/** 1536 → "1.5 КБ", 2147483648 → "2 ГБ" */
export function formatBytes(bytes: number): string {
  const units = ["Б", "КБ", "МБ", "ГБ"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${unit === 0 ? value : value.toFixed(value < 10 ? 1 : 0).replace(/\.0$/, "")} ${units[unit]}`;
}

/** Чатын жагсаалт, мэдэгдэлд харагдах товч: нууц зурвасын текстийг харуулахгүй, файлыг нэрээр нь */
export function previewText(m: { text?: string; ephemeral?: boolean; file?: { name: string } | null }): string {
  if (m.ephemeral) return "⏱ Уншсаны дараа устах зурвас";
  if (m.file) return `📎 ${m.file.name}${m.text ? ` — ${m.text}` : ""}`;
  return m.text ?? "";
}

/** «Уншаад 2 минутад устах» зурвас устах цаг (уншаагүй бол null) */
export const expiresAt = (m: { ephemeral?: boolean; readAt?: number }) =>
  m.ephemeral && m.readAt ? m.readAt + EPHEMERAL_MS : null;

const pad = (n: number) => String(n).padStart(2, "0");

/** "14:05" */
export function chatTime(iso: string | Date): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Огнооны хуваагч: "Өнөөдөр", "Өчигдөр", "11-р сарын 9" */
export function chatDay(iso: string | Date, now = new Date()): string {
  const d = new Date(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(d) === dayKey(now)) return "Өнөөдөр";
  if (dayKey(d) === dayKey(yesterday)) return "Өчигдөр";
  const label = `${d.getMonth() + 1}-р сарын ${d.getDate()}`;
  return d.getFullYear() === now.getFullYear() ? label : `${d.getFullYear()} оны ${label}`;
}

export const sameDay = (a: string | Date, b: string | Date) => dayKey(new Date(a)) === dayKey(new Date(b));

/** Чатын жагсаалтад сүүлийн зурвасын цаг: өнөөдөр бол "14:05", эс бөгөөс "Өчигдөр", "11/09" */
export function chatListTime(iso: string | Date, now = new Date()): string {
  const d = new Date(iso);
  if (sameDay(d, now)) return chatTime(d);
  const day = chatDay(d, now);
  return day === "Өчигдөр" ? day : `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

/** "Идэвхтэй", "5 минутын өмнө идэвхтэй байсан" г.м — хэзээ ч нээгээгүй бол хоосон */
export function presenceText(online: boolean, lastSeenAt: string | null | undefined, now = Date.now()): string {
  if (online) return "Идэвхтэй";
  if (!lastSeenAt) return "";
  const minutes = Math.floor((now - new Date(lastSeenAt).getTime()) / 60_000);
  if (minutes < 1) return "Дөнгөж сая идэвхтэй байсан";
  if (minutes < 60) return `${minutes} минутын өмнө идэвхтэй байсан`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} цагийн өмнө идэвхтэй байсан`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days} хоногийн өмнө идэвхтэй байсан` : `${chatDay(lastSeenAt)}-нд идэвхтэй байсан`;
}
