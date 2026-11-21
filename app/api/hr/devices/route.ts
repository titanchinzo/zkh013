import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Device from "@/lib/models/Device";
import Personnel from "@/lib/models/Personnel";
import { getCurrentRole } from "@/lib/auth-role";
import { isHrRole } from "@/lib/roles";
import { listGroups } from "@/lib/personnel-groups";

// Утсыг таних, түгжээ тайлах нууцын hash, нэг удаагийн challenge — хүний нөөцөд хэзээ ч өгөхгүй
const SECRET_FIELDS = "-tokenHash -unlockHash -unlockedUntil -lockChallenge -lockChallengeAt";
// Апп түгжээний түлхүүр — тохируулсан эсэх (огноо) л харагдана
const LOCK_KEY_FIELDS = "-lock.credentialId -lock.publicKey -lock.counter -lock.transports";

// Утасны бүртгэл: шийдвэр хүлээж буй хүсэлтүүд, зөвшөөрөгдсөн утсууд, сүүлийн шийдвэрүүд
export async function GET() {
  if (!isHrRole(await getCurrentRole())) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  await connectToDatabase();

  const [pending, approved, history, personnel, groups] = await Promise.all([
    Device.find({ status: "pending" }).sort({ createdAt: 1 }).select(`${SECRET_FIELDS} -push -lock`).lean(),
    Device.find({ status: "approved" }).sort({ decidedAt: -1 }).select(`${SECRET_FIELDS} ${LOCK_KEY_FIELDS}`).lean(),
    Device.find({ status: { $in: ["rejected", "revoked"] } }).sort({ decidedAt: -1 }).limit(30).select(`${SECRET_FIELDS} -push -lock`).lean(),
    Personnel.find({ active: true }).sort({ name: 1 }).select("rank name position group phone extraPhones userId").lean(),
    listGroups(),
  ]);

  // Алба хаагчтай холбогдсон утсанд хүсэлтэд бичсэн нэрийг биш, хүний нөөцийн бүртгэлийн (засагдсан) нэрийг харуулна
  const linked = await Personnel.find({ userId: { $in: [...approved, ...history].map((d) => d.userId) } })
    .select("rank name position userId")
    .lean<{ rank: string; name: string; position: string; userId: string }[]>();
  const personOf = new Map(linked.map((p) => [p.userId, p]));
  const asPerson = <T extends { userId: string }>(d: T) => {
    const p = personOf.get(d.userId);
    return p ? { ...d, rank: p.rank, name: p.name, position: p.position } : d;
  };

  return NextResponse.json({
    pending,
    // Мэдэгдэл асаасан, апп түгжээ тохируулсан эсэхийг л харуулна — захиалга, түлхүүрийг биш
    approved: approved.map(({ push, lock, ...d }) => ({
      ...asPerson(d),
      pushEnabled: Boolean(push?.endpoint),
      appLock: Boolean(lock),
    })),
    history: history.map(asPerson),
    personnel,
    groups: groups.map((g) => g.name),
  });
}
