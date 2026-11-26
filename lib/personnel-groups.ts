import "server-only";
import Personnel from "@/lib/models/Personnel";
import PersonnelGroup from "@/lib/models/PersonnelGroup";

/** Тохируулаагүй бол захирагч, орлогч нарын бүлэг нууц дугааруудыг харж, өөрсдийнх нь дугаар нууц байна */
const leadersByDefault = (name: string) => /^захирагч/i.test(name.trim());

export type GroupFlags = (name: string | undefined | null) => { seesAll: boolean; hidesPhones: boolean };

/**
 * Бүлгийн тохиргоо нэрээр нь: seesAll — бүлгийнхэн нууц болон «Шаардлагатай үед» дугааруудыг харж, удирдлагад
 * түрүүлж бичнэ; hidesPhones — бүлгийнхэн удирдлага (дугаар нууц, бусад түрүүлж бичихгүй). Тохируулаагүй бол
 * «Захирагч…» бүлэгт л true. Бүлэггүй бол хоёулаа false.
 */
export async function groupFlags(): Promise<GroupFlags> {
  const docs = await PersonnelGroup.find()
    .select("name seesAll hidesPhones")
    .lean<{ name: string; seesAll?: boolean; hidesPhones?: boolean }[]>();
  const saved = new Map(docs.map((g) => [g.name, g]));
  return (name) => {
    if (!name) return { seesAll: false, hidesPhones: false };
    const g = saved.get(name);
    return { seesAll: g?.seesAll ?? leadersByDefault(name), hidesPhones: g?.hidesPhones ?? leadersByDefault(name) };
  };
}

/** Бүлгүүдийн нэр дарааллаараа (захирагчаас эхлэн) — тоо хэрэггүй үед listGroups-оос хөнгөн */
export async function groupOrder(): Promise<string[]> {
  const groups = await PersonnelGroup.find().sort({ order: 1, name: 1 }).select("name").lean<{ name: string }[]>();
  return groups.map((g) => g.name);
}

/**
 * Алба хаагчтай бүлгүүд дарааллаараа: [{ name, count, seesAll, hidesPhones }]. seesAll — бүлгийнхэн нууц болон
 * «Шаардлагатай үед» дугааруудыг харна; hidesPhones — бүлгийнхний дугаар нууц. Дараалалд бүртгэгдээгүй бүлэг (гараар
 * бичсэн г.м) төгсгөлд нь цагаан толгойгоор. Хоосон бүлэг харагдахгүй (дараалал нь хадгалагдсан хэвээр).
 */
export async function listGroups(): Promise<{ name: string; count: number; seesAll: boolean; hidesPhones: boolean }[]> {
  const [ordered, counts] = await Promise.all([
    PersonnelGroup.find()
      .sort({ order: 1, name: 1 })
      .select("name seesAll hidesPhones")
      .lean<{ name: string; seesAll?: boolean; hidesPhones?: boolean }[]>(),
    Personnel.aggregate<{ _id: string; count: number }>([
      { $match: { group: { $nin: ["", null] } } },
      { $group: { _id: "$group", count: { $sum: 1 } } },
    ]),
  ]);
  const countOf = new Map(counts.map((c) => [c._id, c.count]));
  const saved = new Map(ordered.map((g) => [g.name, g]));
  const names = [
    ...ordered.map((g) => g.name),
    ...counts.map((c) => c._id).filter((name) => !saved.has(name)).sort((a, b) => a.localeCompare(b, "mn")),
  ];
  return names
    .filter((name) => countOf.has(name))
    .map((name) => ({
      name,
      count: countOf.get(name)!,
      seesAll: saved.get(name)?.seesAll ?? leadersByDefault(name),
      hidesPhones: saved.get(name)?.hidesPhones ?? leadersByDefault(name),
    }));
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
