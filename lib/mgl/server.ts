import "server-only";
import { cookies } from "next/headers";
import dictionary from "@/lib/mgl/dictionary.json";
import { SCRIPT_COOKIE, mglDigits, type Script } from "@/lib/mgl/shared";

// Сайтын тогтмол бичвэрүүдийн монгол бичгийн хувилбар (scripts/mgl-sync.mjs-ээр Kimo-оор хөрвүүлж
// lib/mgl/dictionary.json-д хадгалсан). Буруу хөрвүүлсэн үгийг тэр файлд гараар засаж болно.
const DICTIONARY: Record<string, string> = dictionary;

export type Translate = (text: string) => string;

/** Хэрэглэгчийн сонгосон горим (cookie) */
export async function getScript(): Promise<Script> {
  return (await cookies()).get(SCRIPT_COOKIE)?.value === "mgl" ? "mgl" : "mn";
}

/** MGL горимд тогтмол бичвэрийг толь бичгээс авна (олдохгүй бол кириллээр нь), тоог монгол цифрээр */
export function translate(script: Script, text: string) {
  if (script === "mn") return text;
  // Кирилл үсэггүй бичвэр (он, тоо, латин нэр) толь бичигт байхгүй — зөвхөн тоог нь хөрвүүлнэ
  if (!/[А-Яа-яЁёӨөҮү]/.test(text)) return mglDigits(text);
  const found = DICTIONARY[text];
  if (found === undefined && process.env.NODE_ENV !== "production") {
    console.warn(`[mgl] толь бичигт алга: ${JSON.stringify(text)} — "npm run mgl:sync" ажиллуулна уу`);
  }
  return mglDigits(found ?? text);
}

/** Толь бичигт байгаа эсэх (өөрчлөгддөг бичвэрийг хөрвүүлэхээс өмнө шалгахад) */
export function fromDictionary(text: string): string | undefined {
  return DICTIONARY[text];
}

export async function getTranslator(): Promise<{ script: Script; t: Translate }> {
  const script = await getScript();
  return { script, t: (text) => translate(script, text) };
}
