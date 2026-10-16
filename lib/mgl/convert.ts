import "server-only";
import { createHash } from "node:crypto";
import { after } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import MglCache from "@/lib/models/MglCache";
import { kimoConvertLines } from "@/lib/mgl/kimo";
import { fromDictionary } from "@/lib/mgl/server";

// Өөрчлөгддөг бичвэрийг (мэдээ, сургалтын материал) монгол бичигт хөрвүүлнэ:
// толь бичиг → MongoDB кэш → Kimo. Мөр (догол мөр) бүрийг тусад нь кэшлэх тул мэдээг засахад
// зөвхөн өөрчлөгдсөн мөр л дахин хөрвүүлэгдэнэ.

const hash = (text: string) => createHash("sha256").update(text).digest("base64url").slice(0, 40);
const hasCyrillic = (text: string) => /[А-Яа-яЁёӨөҮү]/.test(text);

type CacheDoc = { _id: string; mgl: string };

async function lookup(lines: string[]) {
  const found = new Map<string, string>();
  const pending: string[] = [];
  for (const line of lines) {
    const known = fromDictionary(line);
    if (known !== undefined) found.set(line, known);
    else pending.push(line);
  }
  if (pending.length === 0) return { found, missing: [] as string[] };

  await connectToDatabase();
  const docs = (await MglCache.find({ _id: { $in: pending.map(hash) } }).lean()) as unknown as CacheDoc[];
  const byHash = new Map(docs.map((doc) => [doc._id, doc.mgl]));
  const missing: string[] = [];
  for (const line of pending) {
    const cached = byHash.get(hash(line));
    if (cached !== undefined) found.set(line, cached);
    else missing.push(line);
  }
  return { found, missing };
}

/** Kimo-оор хөрвүүлж кэшэд хадгална */
async function convertAndStore(lines: string[], deadline = Infinity) {
  const converted = await kimoConvertLines(lines, { deadline });
  if (converted.size > 0) {
    await connectToDatabase();
    await MglCache.bulkWrite(
      [...converted].map(([source, mgl]) => ({
        updateOne: { filter: { _id: hash(source) }, update: { $set: { source, mgl } }, upsert: true },
      })),
      { ordered: false }
    );
  }
  return converted;
}

/**
 * Бичвэрүүдийг монгол бичигт хөрвүүлнэ. budgetMs хугацаанд амжаагүй мөрүүдийг кириллээр нь
 * буцааж, хариу илгээсний дараа (after) үргэлжлүүлэн хөрвүүлнэ — дараагийн удаад бэлэн байна.
 */
export async function toMgl(texts: string[], { budgetMs = 7000 } = {}): Promise<string[]> {
  const split = texts.map((text) => (text ?? "").split("\n"));
  const unique = [...new Set(split.flat().filter((line) => line.trim() && hasCyrillic(line)))];
  if (unique.length === 0) return texts;

  let found = new Map<string, string>();
  try {
    const result = await lookup(unique);
    found = result.found;
    if (result.missing.length > 0) {
      const converted = await convertAndStore(result.missing, Date.now() + budgetMs);
      converted.forEach((mgl, source) => found.set(source, mgl));
      const remaining = result.missing.filter((line) => !converted.has(line));
      if (remaining.length > 0) {
        after(() => convertAndStore(remaining).then(() => undefined, () => undefined));
      }
    }
  } catch (err) {
    console.warn("[mgl] хөрвүүлэлт амжилтгүй:", err instanceof Error ? err.message : err);
  }

  return split.map((lines) => lines.map((line) => found.get(line) ?? line).join("\n"));
}

/** Мэдээ хадгалсны дараа монгол бичгийн хувилбарыг урьдчилан бэлдэнэ (хариуг саатуулахгүй) */
export function warmMgl(texts: string[]) {
  after(() => toMgl(texts, { budgetMs: 60000 }).then(() => undefined, () => undefined));
}
