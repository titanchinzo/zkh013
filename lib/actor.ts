import "server-only";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import Device from "@/lib/models/Device";
import Personnel from "@/lib/models/Personnel";
import { getApprovedDevice } from "@/lib/device";
import { personnelLabel } from "@/lib/hr";
import { canReview, isRole, resolveRole, type Role } from "@/lib/roles";

// Хүсэлт илгээсэн хүн — сайтад нэвтэрсэн (Clerk) эсвэл хүний нөөцийн зөвшөөрсөн утсан дээрх апп.
// Эрх нь аль алинд Clerk-ийн publicMetadata.role. Апп Clerk-ийн 7 хоногийн нэвтрэлтээс хамаардаггүй тул утасны
// эзний эрхийг Clerk-ээс серверт уншина (минут тутам шинэчилнэ).

export type Actor = { userId: string; role: Role; name: string; via: "session" | "device" };

type ClerkUser = {
  fullName: string | null;
  publicMetadata: unknown;
  primaryEmailAddress?: { emailAddress: string } | null;
};

const ROLE_TTL_MS = 60_000;
const STAFF_TTL_MS = 5 * 60_000;
const store = globalThis as {
  __zkhUserRoles?: Map<string, { role: Role; name: string; at: number }>;
  __zkhStaff?: { ids: Map<string, Role>; at: number };
};
const roles = (store.__zkhUserRoles ??= new Map());

const nameOf = (user: ClerkUser) => user.fullName ?? user.primaryEmailAddress?.emailAddress ?? "Тодорхойгүй";
const roleOf = (user: ClerkUser) =>
  resolveRole(user.publicMetadata as { role?: string }, user.primaryEmailAddress?.emailAddress);

/** Clerk-ийн хэрэглэгчийн эрх, нэр (кэштэй). Clerk хариу өгөхгүй бол өмнөх утгаа, байхгүй бол эрхгүй. */
export async function userRole(userId: string): Promise<{ role: Role; name: string }> {
  const hit = roles.get(userId);
  if (hit && Date.now() - hit.at < ROLE_TTL_MS) return hit;
  try {
    const user = await (await clerkClient()).users.getUser(userId);
    const value = { role: roleOf(user), name: nameOf(user), at: Date.now() };
    roles.set(userId, value);
    return value;
  } catch {
    return hit ?? { role: null, name: "" };
  }
}

export async function getActor(): Promise<Actor | null> {
  const { userId } = await auth();
  if (userId) {
    const user = await currentUser();
    if (user) return { userId, role: roleOf(user), name: nameOf(user), via: "session" };
  }
  const device = await getApprovedDevice();
  if (!device) return null;
  const { role, name } = await userRole(device.userId);
  // Апп-д хүний нөөцийн бүртгэлийн нэр (цолтой) — Clerk-д нэр бичээгүй бол и-мэйл гарахаас сэргийлнэ
  const person = await Personnel.findOne({ userId: device.userId }).select("rank name").lean<{ rank: string; name: string }>();
  return { userId: device.userId, role, name: person ? personnelLabel(person) : name, via: "device" };
}

/** Хэн бэ гэдгийг л (эрхгүйгээр, Clerk API дуудахгүй) — файлын хэсэг илгээх г.м */
export async function getActorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? (await getApprovedDevice())?.userId ?? null;
}

/** Эрхтэй бүх хэрэглэгч (Clerk-ээс, 5 минутын кэштэй) — мэдэгдэл хэнд илгээхийг шийдэхэд */
async function staffRoles(): Promise<Map<string, Role>> {
  const cached = store.__zkhStaff;
  if (cached && Date.now() - cached.at < STAFF_TTL_MS) return cached.ids;
  const client = await clerkClient();
  const ids = new Map<string, Role>();
  for (let offset = 0; ; offset += 500) {
    const { data } = await client.users.getUserList({ limit: 500, offset });
    for (const user of data) {
      const role = roleOf(user);
      if (isRole(role)) ids.set(user.id, role);
    }
    if (data.length < 500) break;
  }
  store.__zkhStaff = { ids, at: Date.now() };
  return ids;
}

/** Мэдээ хянах эрхтэй (хянагч, админ), утсаа бүртгүүлсэн хүмүүс — except-ийг хасна */
export async function newsReviewerIds(except?: string): Promise<string[]> {
  await connectToDatabase();
  const [staff, withApp] = await Promise.all([staffRoles(), Device.distinct("userId", { status: "approved" })]);
  return (withApp as string[]).filter((id) => id !== except && canReview(staff.get(id) ?? null));
}
