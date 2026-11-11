import "server-only";
import Personnel from "@/lib/models/Personnel";
import PersonnelGroup from "@/lib/models/PersonnelGroup";

/** Тохируулаагүй бол захирагч, орлогч нарын бүлэг бүх утасны жагсаалтыг харна */
const seesAllByDefault = (name: string) => /^захирагч/i.test(name.trim());

/** Энэ бүлгийнхэн бүх хүний утасны жагсаалтыг харах эсэх */
export async function groupSeesAll(name: string | undefined | null): Promise<boolean> {
  if (!name) return false;
  const doc = await PersonnelGroup.findOne({ name }).select("seesAll").lean<{ seesAll?: boolean }>();
  return doc?.seesAll ?? seesAllByDefault(name);
}

/**
 * Алба хаагчтай бүлгүүд дарааллаараа: [{ name, count, seesAll }]. Дараалалд бүртгэгдээгүй бүлэг (гараар бичсэн г.м)
 * төгсгөлд нь цагаан толгойгоор. Хоосон бүлэг харагдахгүй (дараалал нь хадгалагдсан хэвээр).
 */
export async function listGroups(): Promise<{ name: string; count: number; seesAll: boolean }[]> {
  const [ordered, counts] = await Promise.all([
    PersonnelGroup.find().sort({ order: 1, name: 1 }).select("name seesAll").lean<{ name: string; seesAll?: boolean }[]>(),
    Personnel.aggregate<{ _id: string; count: number }>([
      { $match: { group: { $nin: ["", null] } } },
      { $group: { _id: "$group", count: { $sum: 1 } } },
    ]),
  ]);
  const countOf = new Map(counts.map((c) => [c._id, c.count]));
  const flagOf = new Map(ordered.map((g) => [g.name, g.seesAll]));
  const names = [
    ...ordered.map((g) => g.name),
    ...counts.map((c) => c._id).filter((name) => !flagOf.has(name)).sort((a, b) => a.localeCompare(b, "mn")),
  ];
  return names
    .filter((name) => countOf.has(name))
    .map((name) => ({ name, count: countOf.get(name)!, seesAll: flagOf.get(name) ?? seesAllByDefault(name) }));
}

/** Шинэ бүлгүүдийг (өгсөн дарааллаар нь) дарааллын төгсгөлд нэмнэ — байгаа бүлгийн дараалал өөрчлөгдөхгүй */
export async function ensureGroups(names: string[]) {
  const wanted = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (!wanted.length) return;
  const existing = await PersonnelGroup.find({ name: { $in: wanted } }).select("name").lean<{ name: string }[]>();
  const missing = wanted.filter((name) => !existing.some((g) => g.name === name));
  if (!missing.length) return;
  const last = await PersonnelGroup.findOne().sort({ order: -1 }).select("order").lean<{ order: number }>();
  const start = last?.order ?? 0;
  await PersonnelGroup.bulkWrite(
    missing.map((name, i) => ({
      updateOne: { filter: { name }, update: { $setOnInsert: { name, order: start + i + 1 } }, upsert: true },
    }))
  );
}
