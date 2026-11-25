import { formatPhone, normalizePhone } from "@/lib/hr";

// iPhone дээр апп дуугүй горимыг давж чадахгүй. Яаралтай үед хүний нөөц, жижүүр залгадаг дугаарыг алба хаагч утсандаа
// хадгалаад Emergency Bypass асаавал тэр дугаарын дуудлага утас дуугүй ч дуугарна. Утас энэ тохиргоог апп-д хэлдэггүй:
// хэрэглэгч өөрөө тэмдэглэнэ ("set"), хүний нөөц залгаж шалгаад баталгаажуулна ("tested").

export const BYPASS_MAX_NUMBERS = 5;
export const BYPASS_CONTACT_NAME = "013 анги";

/** none — тохируулаагүй; changed — тохируулснаас хойш шинэ дугаар нэмэгдсэн; set — өөрөө тэмдэглэсэн; tested — залгаж шалгасан */
export type BypassState = "none" | "changed" | "set" | "tested";

export const BYPASS_LABEL: Record<BypassState, string> = {
  none: "Тохируулаагүй",
  changed: "Шинэ дугаар хадгалаагүй",
  set: "Өөрөө тэмдэглэсэн",
  tested: "Залгаж шалгасан",
};

export function bypassState(
  saved: { numbers?: string[] | null; testedAt?: Date | string | null } | null | undefined,
  numbers: string[]
): BypassState {
  const known = saved?.numbers ?? [];
  if (known.length === 0) return "none";
  if (numbers.some((n) => !known.includes(n))) return "changed";
  return saved?.testedAt ? "tested" : "set";
}

/** Хүний нөөцийн бичсэн дугаарууд: 8 оронтой, давхардалгүй. Хоосон бол iPhone-ы заавар хэнд ч харагдахгүй */
export function parseBypassNumbers(value: unknown): { ok: true; value: string[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) return { ok: false, error: "Дугаараа оруулна уу" };
  const numbers: string[] = [];
  for (const raw of value) {
    const phone = typeof raw === "string" ? normalizePhone(raw) : null;
    if (!phone) return { ok: false, error: `Дугаар буруу байна: ${String(raw).slice(0, 30)} (8 оронтой)` };
    if (!numbers.includes(phone)) numbers.push(phone);
  }
  if (numbers.length > BYPASS_MAX_NUMBERS) return { ok: false, error: `Хамгийн ихдээ ${BYPASS_MAX_NUMBERS} дугаар` };
  return { ok: true, value: numbers };
}

export const telHref = (phone: string) => `tel:+976${phone}`;

/** Бүх дугаартай нэг харилцагч (vCard) — iPhone-д нээхэд «Create New Contact» гарна */
export function bypassContactCard(numbers: string[]): string {
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${BYPASS_CONTACT_NAME};;;;`,
    `FN:${BYPASS_CONTACT_NAME}`,
    ...numbers.map((n) => `TEL;TYPE=VOICE:+976${n}`),
    "END:VCARD",
    "",
  ].join("\r\n");
}

export const formatNumbers = (numbers: string[]) => numbers.map(formatPhone).join(", ");

/** Бүртгүүлэхдээ танигдсан утасны төрөл (lib/device.ts-ийн deviceLabel: "iPhone · Safari", "Android · Chrome") */
export function phoneKind(label: string): "iphone" | "android" | "other" {
  if (label.startsWith("iPhone")) return "iphone";
  return label.startsWith("Android") ? "android" : "other";
}
