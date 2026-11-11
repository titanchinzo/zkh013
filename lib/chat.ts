import "server-only";
import { NextResponse } from "next/server";
import { getApprovedDevice } from "@/lib/device";
import Device from "@/lib/models/Device";
import Personnel from "@/lib/models/Personnel";
import { ONLINE_MS } from "@/lib/chat-shared";

// Утсан дээрх аппын чат (сервер тал). Чат ашиглах эрхтэй хүн — хүний нөөц зөвшөөрсөн утастай, идэвхтэй алба
// хаагчийн бүртгэлтэй хэрэглэгч. Утсыг Clerk биш төхөөрөмжийн cookie-гоор таньдаг (lib/device.ts).

/** Нэг хүн минутад илгээх зурвасын дээд тоо */
export const MESSAGES_PER_MINUTE = 30;

/** Clerk userId — Map-ийн түлхүүр болгоход аюулгүй (цэг, $ тэмдэгтгүй) */
export const isUserId = (value: unknown): value is string =>
  typeof value === "string" && /^user_[A-Za-z0-9]{10,64}$/.test(value);

/** Хоёр хүний чатын түлхүүр — дарааллаас үл хамааран ижил */
export const chatKey = (a: string, b: string) => [a, b].sort().join("|");

export const isOnline = (lastSeenAt?: Date | null, now = Date.now()) =>
  Boolean(lastSeenAt && now - new Date(lastSeenAt).getTime() < ONLINE_MS);

type Me = { rank: string; name: string; position: string; photo?: string; userId: string };

/** Энэ утсаар чат ашиглаж буй хүн, эсвэл хариулах алдаа */
export async function getChatUser(): Promise<{ me: string; person: Me } | { error: NextResponse }> {
  const device = await getApprovedDevice();
  if (!device) {
    return { error: NextResponse.json({ error: "Энэ утсыг хүний нөөц зөвшөөрөөгүй байна" }, { status: 403 }) };
  }
  const person = await Personnel.findOne({ userId: device.userId, active: true })
    .select("rank name position photo userId")
    .lean<Me>();
  if (!person) {
    return { error: NextResponse.json({ error: "Таны алба хаагчийн бүртгэл идэвхгүй байна" }, { status: 403 }) };
  }
  return { me: device.userId, person };
}

/** Хүн бүрийн зөвшөөрөгдсөн утас хамгийн сүүлд хандсан цаг. userIds өгөөгүй бол бүх хүнийх */
export async function approvedLastSeen(userIds?: string[]) {
  const devices = await Device.find({ status: "approved", ...(userIds ? { userId: { $in: userIds } } : {}) })
    .select("userId lastSeenAt")
    .lean<{ userId: string; lastSeenAt?: Date }[]>();
  const seen = new Map<string, Date | null>();
  for (const d of devices) {
    const prev = seen.get(d.userId);
    if (!seen.has(d.userId) || (d.lastSeenAt && (!prev || d.lastSeenAt > prev))) seen.set(d.userId, d.lastSeenAt ?? null);
  }
  return seen;
}

// Хэн одоо аль хүнтэй чатаа нээж харж байгаа — тэр хүнд тухайн чатын зурвасыг мэдэгдлээр давхар илгээхгүй.
// Сервер ганц процесс тул санах ойд хадгална (дахин асахад хоосорно — тэгвэл мэдэгдэл л очно).
type Viewing = Map<string, { with: string; at: number }>;
const store = globalThis as typeof globalThis & { __zkhChatViewing?: Viewing };
const viewing: Viewing = (store.__zkhChatViewing ??= new Map());
// Чат дотор утас 2.5 секунд тутам асуудаг — хоёр удаа асуугаагүй бол хаасан гэж үзнэ
const VIEWING_MS = 7_000;

export function markViewing(userId: string, withUserId: string) {
  viewing.set(userId, { with: withUserId, at: Date.now() });
}

export function clearViewing(userId: string) {
  viewing.delete(userId);
}

export function isViewing(userId: string, withUserId: string) {
  const v = viewing.get(userId);
  return Boolean(v && v.with === withUserId && Date.now() - v.at < VIEWING_MS);
}
