import "server-only";

// Kimo хөрвүүлэгч (Болорсофт ХХК, https://kimo.mngl.net) — кирилл бичвэрийг монгол бичигт хөрвүүлнэ.
// Нийтэд нээлттэй онлайн хувилбарын API тул ачаалал өгөхгүйн тулд хүсэлтийг дарааллаар,
// багцалж илгээж, үр дүнг lib/mgl/convert.ts-д кэшлэнэ.

const ENDPOINT = "https://kimo.mngl.net/pub/convert";
const REQUEST_TIMEOUT_MS = 20000;
const BATCH_MAX_LINES = 12;
const BATCH_MAX_CHARS = 1500;
const PAUSE_MS = 300;

class KimoBusyError extends Error {}

async function request(text: string): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Use-Variable-Words": "false",
      "Convert-Numbers": "false",
      "User-Agent": "zkh013-site/1.0 (+https://zkh013-topaz.vercel.app)",
    },
    body: JSON.stringify({ text, direction: "to-mng" }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  if (res.status === 429) throw new KimoBusyError("Kimo: хэт олон хүсэлт");
  if (!res.ok) throw new Error(`Kimo: HTTP ${res.status}`);
  const data = (await res.json()) as { result?: unknown };
  return String(data.result ?? "");
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Нэг хүсэлт, 429 үед нэг удаа хүлээгээд дахин оролдоно */
async function requestWithRetry(text: string) {
  try {
    return await request(text);
  } catch (err) {
    if (!(err instanceof KimoBusyError)) throw err;
    await pause(2500);
    return request(text);
  }
}

function batches(lines: string[]) {
  const result: string[][] = [];
  let current: string[] = [];
  let size = 0;
  for (const line of lines) {
    if (current.length && (current.length >= BATCH_MAX_LINES || size + line.length > BATCH_MAX_CHARS)) {
      result.push(current);
      current = [];
      size = 0;
    }
    current.push(line);
    size += line.length;
  }
  if (current.length) result.push(current);
  return result;
}

/**
 * Мөрүүдийг (мөр бүр дотроо шинэ мөргүй) хөрвүүлнэ. Багцаар илгээж, хариуны мөрийн тоо таарахгүй
 * бол тухайн багцыг нэг нэгээр нь хөрвүүлнэ. deadline өнгөрвөл үлдсэнийг орхино.
 */
export async function kimoConvertLines(lines: string[], { deadline = Infinity } = {}) {
  const converted = new Map<string, string>();
  for (const batch of batches(lines)) {
    if (Date.now() > deadline) break;
    try {
      const output = (await requestWithRetry(batch.join("\n"))).split("\n");
      if (output.length === batch.length) {
        batch.forEach((line, i) => converted.set(line, output[i]));
      } else {
        for (const line of batch) {
          if (Date.now() > deadline) break;
          converted.set(line, (await requestWithRetry(line)).replace(/\n/g, " "));
          await pause(PAUSE_MS);
        }
      }
    } catch (err) {
      console.warn("[kimo] хөрвүүлж чадсангүй:", err instanceof Error ? err.message : err);
      break;
    }
    await pause(PAUSE_MS);
  }
  return converted;
}
