// Монгол бичгийн толь бичгийг (lib/mgl/dictionary.json) шинэчилнэ.
//
//   npm run mgl:sync    — кодонд байгаа t("…") бичвэрүүд болон өгөгдлийн файлуудын кирилл бичвэрүүдээс
//                         толь бичигт байхгүйг нь Kimo-оор (https://kimo.mngl.net) хөрвүүлж нэмнэ,
//                         ашиглагдахаа больсныг хасна.
//   npm run mgl:check   — дутуу орчуулга байвал алдаа өгнө (сүлжээ шаардахгүй).
//
// Kimo буруу хөрвүүлсэн үгийг dictionary.json-д гараар засаж болно — дахин sync хийхэд засвар хэвээр үлдэнэ.

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DICTIONARY_FILE = path.join(ROOT, "lib/mgl/dictionary.json");

// t("…") дуудлага хайх хавтсууд (админы хэсэг кириллээр үлдэнэ)
const SCAN_DIRS = ["app", "components", "lib"];
const SKIP_DIRS = ["app/admin", "app/api", "app/sign-in", "app/sign-up"];
// Эдгээр файлын бүх кирилл бичвэр сайтад харагддаг өгөгдөл тул бүгдийг хөрвүүлнэ
const DATA_FILES = ["lib/unit-history.ts", "lib/site.ts", "lib/contact.ts"];

const KIMO = "https://kimo.mngl.net/pub/convert";
const BATCH_LINES = 40;
const BATCH_CHARS = 4000;
const PAUSE_MS = 3000; // Kimo олон хүсэлтийг хязгаарладаг (429) тул завсарлана

const hasCyrillic = (text) => /[А-Яа-яЁёӨөҮү]/.test(text);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(ROOT, full).replace(/\\/g, "/");
    if (SKIP_DIRS.some((skip) => rel === skip || rel.startsWith(skip + "/"))) continue;
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(name)) files.push(full);
  }
  return files;
}

const unescape = (raw, quote) => {
  if (quote === "`") return raw.replace(/\\`/g, "`").replace(/\\\\/g, "\\");
  return JSON.parse(`"${raw.replace(/\\'/g, "'").replace(/(?<!\\)"/g, '\\"')}"`);
};

/** t("…"), t('…'), t(`…`) дуудлагын бичвэрүүд */
function extractCalls(source) {
  const found = [];
  const pattern = /\bt\(\s*(["'`])((?:\\.|(?!\1)[^\\\n])*)\1\s*[,)]/g;
  for (const match of source.matchAll(pattern)) {
    if (match[1] === "`" && match[2].includes("${")) continue;
    found.push(unescape(match[2], match[1]));
  }
  return found;
}

/** Файлын бүх string literal (тайлбар мөрийг алгасна) */
function extractLiterals(source) {
  const found = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === "/" && next === "/") {
      i = source.indexOf("\n", i);
      if (i < 0) break;
      continue;
    }
    if (ch === "/" && next === "*") {
      i = source.indexOf("*/", i + 2) + 2;
      if (i < 2) break;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      let raw = "";
      while (j < source.length && source[j] !== ch) {
        if (source[j] === "\\") {
          raw += source[j] + source[j + 1];
          j += 2;
          continue;
        }
        raw += source[j];
        j++;
      }
      if (!(ch === "`" && raw.includes("${"))) found.push(unescape(raw, ch));
      i = j + 1;
      continue;
    }
    i++;
  }
  return found;
}

function collect() {
  const strings = new Set();
  for (const dir of SCAN_DIRS) {
    for (const file of walk(path.join(ROOT, dir))) {
      for (const text of extractCalls(readFileSync(file, "utf8"))) strings.add(text);
    }
  }
  for (const file of DATA_FILES) {
    for (const text of extractLiterals(readFileSync(path.join(ROOT, file), "utf8"))) {
      if (hasCyrillic(text)) strings.add(text);
    }
  }
  return [...strings].filter((text) => text.trim() !== "");
}

async function kimo(text) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(KIMO, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Use-Variable-Words": "false",
          "Convert-Numbers": "false",
          "User-Agent": "zkh013-site/1.0 (+https://zkh013-topaz.vercel.app)",
        },
        body: JSON.stringify({ text, direction: "to-mng" }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.status === 429) throw new Error("Kimo: хэт олон хүсэлт (429)");
      if (!res.ok) throw new Error(`Kimo HTTP ${res.status}`);
      const data = await res.json();
      await pause(PAUSE_MS);
      return String(data.result ?? "");
    } catch (err) {
      // Сүлжээний түр алдаа, 429 — хүлээгээд дахин оролдоно
      lastError = err;
      await pause(15000 * (attempt + 1));
    }
  }
  throw lastError;
}

/** Олон мөрийг нэг хүсэлтээр хөрвүүлнэ; хариуны мөрийн тоо таарахгүй бол нэг нэгээр нь */
async function convertBatch(lines) {
  const result = new Map();
  const output = (await kimo(lines.join("\n"))).split("\n");
  if (output.length === lines.length) {
    lines.forEach((line, i) => result.set(line, output[i].trim()));
  } else {
    for (const line of lines) result.set(line, (await kimo(line)).replace(/\n/g, " ").trim());
  }
  return result;
}

/** Бичвэрүүдийг багцлан хөрвүүлж, багц бүрийн дараа onBatch-ээр хадгалуулна (тасарвал дахин эхлэхэд үргэлжилнэ) */
async function convertTexts(texts, onBatch) {
  const groups = [];
  let group = [];
  let lineCount = 0;
  let size = 0;
  for (const text of texts) {
    const lines = text.split("\n").filter((line) => hasCyrillic(line));
    if (group.length && (lineCount + lines.length > BATCH_LINES || size + text.length > BATCH_CHARS)) {
      groups.push(group);
      group = [];
      lineCount = 0;
      size = 0;
    }
    group.push(text);
    lineCount += lines.length;
    size += text.length;
  }
  if (group.length) groups.push(group);

  for (const texts of groups) {
    const lines = [...new Set(texts.flatMap((text) => text.split("\n")).filter((line) => hasCyrillic(line)))];
    const converted = lines.length > 0 ? await convertBatch(lines) : new Map();
    const entries = texts.map((text) => [
      text,
      text
        .split("\n")
        .map((line) => (hasCyrillic(line) ? (converted.get(line) ?? line) : line))
        .join("\n"),
    ]);
    onBatch(entries);
  }
}

async function main() {
  const check = process.argv.includes("--check");
  const dictionary = JSON.parse(readFileSync(DICTIONARY_FILE, "utf8"));
  const needed = collect();
  const missing = needed.filter((text) => !(text in dictionary));
  const unused = Object.keys(dictionary).filter((key) => !needed.includes(key));

  console.log(`Бичвэр: ${needed.length}, толь бичигт байхгүй: ${missing.length}, ашиглагдаагүй: ${unused.length}`);
  if (check) {
    if (missing.length > 0) {
      console.error("Монгол бичгийн орчуулга дутуу:\n" + missing.map((text) => `  - ${text}`).join("\n"));
      console.error('"npm run mgl:sync" ажиллуулна уу.');
      process.exit(1);
    }
    return;
  }

  const save = () => {
    const sorted = Object.fromEntries(Object.keys(dictionary).sort().map((key) => [key, dictionary[key]]));
    writeFileSync(DICTIONARY_FILE, JSON.stringify(sorted, null, 2) + "\n");
  };

  for (const key of unused) delete dictionary[key];
  save();

  // Бичвэр бүрийг мөрөөр нь хувааж хөрвүүлнэ (Kimo хоосон мөр, "…" дараах мөрийг нийлүүлдэг).
  // Багц бүрийн дараа хадгалах тул сүлжээ тасарвал дахин ажиллуулахад үлдсэнээс нь үргэлжилнэ.
  let added = 0;
  await convertTexts(missing, (entries) => {
    for (const [text, mgl] of entries) dictionary[text] = mgl;
    added += entries.length;
    save();
    process.stdout.write(`\r  ${added}/${missing.length} хөрвүүлсэн`);
  });
  console.log(`\nХадгаллаа: ${Object.keys(dictionary).length} бичвэр (${added} шинэ, ${unused.length} хассан)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
