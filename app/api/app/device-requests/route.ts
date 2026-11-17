import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Device from "@/lib/models/Device";
import Personnel from "@/lib/models/Personnel";
import { getActor } from "@/lib/actor";
import { suggestPerson } from "@/lib/hr";
import { listGroups } from "@/lib/personnel-groups";
import { isHrRole } from "@/lib/roles";

type PendingDoc = {
  _id: unknown;
  userId: string;
  email?: string;
  rank: string;
  name: string;
  position: string;
  phone?: string;
  label: string;
  createdAt: Date;
};
type PersonDoc = {
  _id: unknown;
  rank: string;
  name: string;
  position: string;
  group?: string;
  phone?: string;
  extraPhones?: string[];
  userId?: string;
};

/**
 * Утсан дээрх апп: шийдвэр хүлээж буй утасны хүсэлтүүд — зөвхөн хүний нөөц, админ (утсаараа, төхөөрөмжөөр нь таньна).
 * Хүсэлт бүрт хүний нөөцийн аль бүртгэлтэй холбохыг санал болгоно (suggestedId, why). personnel — холбож болох
 * (өөр хэрэглэгчтэй холбогдоогүй) алба хаагчид, groups — бүлгийн дараалал.
 */
export async function GET() {
  const actor = await getActor();
  if (!actor || !isHrRole(actor.role)) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  await connectToDatabase();

  const pending = await Device.find({ status: "pending" })
    .sort({ createdAt: 1 })
    .select("userId email rank name position phone label createdAt")
    .lean<PendingDoc[]>();
  if (!pending.length) return NextResponse.json({ requests: [], personnel: [], groups: [] });

  const requesters = new Set(pending.map((d) => d.userId));
  const [everyone, groups] = await Promise.all([
    Personnel.find({ active: true }).sort({ name: 1 }).select("rank name position group phone extraPhones userId").lean<PersonDoc[]>(),
    listGroups(),
  ]);
  // Холбож болох: хэнтэй ч холбогдоогүй, эсвэл өөрт нь (утсаа солиж байгаа)
  const personnel = everyone
    .filter((p) => !p.userId || requesters.has(p.userId))
    .map((p) => ({
      _id: String(p._id),
      rank: p.rank,
      name: p.name,
      position: p.position,
      group: p.group,
      phone: p.phone,
      extraPhones: p.extraPhones,
      userId: p.userId,
    }));

  return NextResponse.json({
    requests: pending.map((d) => {
      const match = suggestPerson({ userId: d.userId, name: d.name, phone: d.phone }, personnel);
      return {
        id: String(d._id),
        userId: d.userId,
        email: d.email ?? "",
        rank: d.rank,
        name: d.name,
        position: d.position,
        phone: d.phone ?? "",
        label: d.label,
        createdAt: d.createdAt,
        suggestedId: match?.person._id ?? null,
        why: match?.why ?? null,
      };
    }),
    personnel,
    groups: groups.map((g) => g.name),
  });
}
