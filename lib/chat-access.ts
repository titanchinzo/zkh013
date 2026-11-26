import "server-only";
import { userRole } from "@/lib/actor";
import { connectToDatabase } from "@/lib/mongodb";
import ChatDeletion from "@/lib/models/ChatDeletion";
import ChatFile from "@/lib/models/ChatFile";
import ChatMessage from "@/lib/models/ChatMessage";
import ChatPermit from "@/lib/models/ChatPermit";
import ChatReceipt from "@/lib/models/ChatReceipt";
import Personnel from "@/lib/models/Personnel";
import { groupFlags, type GroupFlags } from "@/lib/personnel-groups";

// Удирдлагатай холбогдох дүрэм (аппын «Утас», «Чат»). Удирдлага — «Дугаар нууц» тохиргоотой хүн (захирагч, орлогч
// нарын бүлэг анхнаасаа; хүний нөөц бүлгээр эсвэл хүнээр нь). Түүний дугаар нууц, түүнд түрүүлж чат бичихгүй.
// Үл хамаарах: өөрийн бүлгийнхэн нь; «Бүх утас харна» (хүнээр эсвэл бүлгээр), хүний нөөц, админ. Удирдлага өөрөө
// түрүүлж бичсэн, эсвэл өмнө бичилцсэн хос (ChatPermit) чатаа үргэлжлүүлнэ.

export const CLOSED_ERROR = "Удирдлагад түрүүлж бичих боломжгүй — тэд бичсэн бол хариулж болно";
// 403 биш: апп 403-ыг «утас хүчингүй болсон» гэж үзээд чатын түүхийг устгадаг
export const CLOSED_STATUS = 409;

type Member = { userId?: string; group?: string; hidePhone?: boolean; seesAllPhones?: boolean };

const pair = (x: string, y: string) => (x < y ? { a: x, b: y } : { a: y, b: x });

/** Удирдлага — «Дугаар нууц» (хүнээр эсвэл бүлгээр) */
export const isLeader = (p: Member, flags: GroupFlags) => Boolean(p.hidePhone) || flags(p.group).hidesPhones;

/** Нууц дугаар харж, удирдлагад түрүүлж бичнэ: «Бүх утас харна» (хүнээр, бүлгээр), хүний нөөц, админ */
async function privileged(viewer: Member & { userId: string }, flags: GroupFlags) {
  if (viewer.seesAllPhones || flags(viewer.group).seesAll) return true;
  const { role } = await userRole(viewer.userId);
  return role === "admin" || role === "hr";
}

/**
 * viewer-т хамаарах дүрэм: all — нууц болон «Шаардлагатай үед» дугааруудыг харна, удирдлагад түрүүлж бичнэ;
 * closed(p) — p нь viewer-т хаалттай удирдлага (дугаар нь нууц; өмнө бичилцээгүй бол түрүүлж бичихгүй).
 */
export async function contactRules(viewer: Member & { userId: string }) {
  const flags = await groupFlags();
  const all = await privileged(viewer, flags);
  const closed = (p: Member) =>
    !all && p.userId !== viewer.userId && !(viewer.group && p.group === viewer.group) && isLeader(p, flags);
  return { all, closed };
}

/** userIds-ээс me-тэй өмнө бичилцсэн (ChatPermit) хүмүүс */
export async function permittedWith(me: string, userIds: string[]): Promise<Set<string>> {
  if (!userIds.length) return new Set();
  const docs = await ChatPermit.find({ $or: [{ a: me, b: { $in: userIds } }, { b: me, a: { $in: userIds } }] })
    .select("a b")
    .lean<{ a: string; b: string }[]>();
  return new Set(docs.map((d) => (d.a === me ? d.b : d.a)));
}

/**
 * me → other чат. blocked — other нь me-д хаалттай удирдлага, өмнө бичилцээгүй (түрүүлж бичихгүй). leaders — хоёрын
 * аль нэг нь удирдлага: зурвас илгээвэл хосыг rememberPair-ээр бүртгэнэ (тэгвэл нөгөө нь хариулна).
 */
export async function chatAccess(me: Member & { userId: string }, other: Member & { userId: string }) {
  const flags = await groupFlags();
  const leaders = isLeader(me, flags) || isLeader(other, flags);
  if (!isLeader(other, flags) || (me.group && other.group === me.group)) return { blocked: false, leaders };
  if (await ChatPermit.exists(pair(me.userId, other.userId))) return { blocked: false, leaders };
  return { blocked: !(await privileged(me, flags)), leaders };
}

/** Удирдлагатай бичилцсэн хосыг бүртгэнэ */
export async function rememberPair(x: string, y: string) {
  const p = pair(x, y);
  // Зэрэг илгээхэд давхардсан түлхүүрийн алдаа гарч болно — аль хэдийн бүртгэгдсэн гэсэн үг
  await ChatPermit.updateOne(p, { $setOnInsert: p }, { upsert: true }).catch(() => {});
}

/**
 * Удирдлага (userIds өгвөл тэднээс) хэнтэй бичилцсэнийг серверт үлдсэн чатын тэмдэглэлээс (уншаагүй зурвас, уншсан
 * тэмдэглэл — 30 хоног, «хоёулангаас устгасан» зурвас, файл) олж ChatPermit-д бүртгэнэ: хязгаарлалт гарахаас өмнө,
 * эсвэл удирдлага болохоос өмнө бичилцсэн хүмүүс чатаа үргэлжлүүлнэ. Чат 2026-11-11-нд эхэлсэн тул 2026-11-26-ны
 * байдлаар бүх чат тэмдэглэлтэй. Сервер асах бүрд, хүний нөөц удирдлага тэмдэглэхэд ажиллана (давхардуулахгүй).
 */
export async function rememberConversations(userIds?: string[]) {
  await connectToDatabase();
  const flags = await groupFlags();
  const people = await Personnel.find({ userId: userIds ? { $in: userIds } : { $type: "string" } })
    .select("userId group hidePhone")
    .lean<{ userId: string; group?: string; hidePhone?: boolean }[]>();
  const leaders = people.filter((p) => isLeader(p, flags)).map((p) => p.userId);
  if (!leaders.length) return 0;

  const touching = (x: string, y: string) => ({ $or: [{ [x]: { $in: leaders } }, { [y]: { $in: leaders } }] });
  type Pair = { sender: string; recipient?: string };
  const [receipts, messages, deletions, files] = await Promise.all([
    ChatReceipt.find(touching("reader", "sender")).select("reader sender").lean<{ reader: string; sender: string }[]>(),
    ChatMessage.find({ recipient: { $type: "string" }, ...touching("sender", "recipient") })
      .select("sender recipient")
      .lean<Pair[]>(),
    // group: null — зөвхөн хоёр хүний чатын зурвас
    ChatDeletion.find({ group: null, ...touching("sender", "recipient") })
      .select("sender recipient")
      .lean<Pair[]>(),
    ChatFile.find({ recipient: { $type: "string" }, ...touching("sender", "recipient") })
      .select("sender recipient")
      .lean<Pair[]>(),
  ]);
  const pairs = new Map<string, { a: string; b: string }>();
  const add = (x?: string, y?: string) => {
    if (!x || !y || x === y) return;
    const p = pair(x, y);
    pairs.set(`${p.a} ${p.b}`, p);
  };
  for (const r of receipts) add(r.reader, r.sender);
  for (const m of [...messages, ...deletions, ...files]) add(m.sender, m.recipient);
  if (!pairs.size) return 0;
  await ChatPermit.bulkWrite(
    [...pairs.values()].map((p) => ({ updateOne: { filter: p, update: { $setOnInsert: p }, upsert: true } })),
    { ordered: false }
  ).catch((err) => console.error("[chat] удирдлагатай бичилцсэн хосыг бүртгэж чадсангүй:", err));
  return pairs.size;
}
