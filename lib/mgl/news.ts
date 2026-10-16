import "server-only";
import { toMgl } from "@/lib/mgl/convert";

/** Мэдээний гарчиг, товч тайлбарыг монгол бичигт хөрвүүлсэн хуулбар */
export async function mglNewsSummaries<T extends { title: string; excerpt: string }>(items: T[]): Promise<T[]> {
  if (items.length === 0) return items;
  const converted = await toMgl(items.flatMap((item) => [item.title, item.excerpt]));
  return items.map((item, i) => ({ ...item, title: converted[i * 2], excerpt: converted[i * 2 + 1] }));
}
