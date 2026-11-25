import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Device from "@/lib/models/Device";
import Personnel from "@/lib/models/Personnel";
import { getActor } from "@/lib/actor";
import { isHrRole } from "@/lib/roles";
import { bypassState, parseBypassNumbers, phoneKind } from "@/lib/bypass";
import { comparePersonnel, personnelLabel } from "@/lib/hr";
import { listGroups } from "@/lib/personnel-groups";
import { getBypassNumbers, setBypassNumbers } from "@/lib/settings";

const FORBIDDEN = { error: "Зөвшөөрөлгүй" };

type DeviceDoc = {
  _id: unknown;
  userId: string;
  rank: string;
  name: string;
  position: string;
  phone?: string;
  label: string;
  push?: { endpoint?: string };
  apk?: number;
  bypass?: { numbers?: string[]; at?: Date; testedAt?: Date };
  lastSeenAt?: Date;
};
type PersonDoc = { userId: string; rank: string; name: string; position: string; group?: string; phone?: string };

/**
 * Дохионы бэлэн байдал: зөвшөөрөгдсөн утас бүр улаан дохиог дуугүй үед сонсох эсэх — Android апп, iPhone-ы Emergency Bypass,
 * мэдэгдэл. Сайтаас эсвэл утсан дээрх аппаас (хүний нөөц, админ). numbers — яаралтай үед залгах дугаарууд.
 */
export async function GET() {
  const actor = await getActor();
  if (!actor || !isHrRole(actor.role)) return NextResponse.json(FORBIDDEN, { status: 403 });
  await connectToDatabase();

  const [numbers, devices, groups] = await Promise.all([
    getBypassNumbers(),
    Device.find({ status: "approved" })
      .select("userId rank name position phone label push.endpoint apk bypass lastSeenAt")
      .lean<DeviceDoc[]>(),
    listGroups(),
  ]);
  // Алба хаагчтай холбогдсон утсанд хүний нөөцийн бүртгэлийн нэр, дугаар
  const people = await Personnel.find({ userId: { $in: devices.map((d) => d.userId) } })
    .select("userId rank name position group phone")
    .lean<PersonDoc[]>();
  const personOf = new Map(people.map((p) => [p.userId, p]));
  const rows = devices.map((d) => {
    const p = personOf.get(d.userId);
    return { d, rank: p?.rank ?? d.rank, name: p?.name ?? d.name, position: p?.position ?? d.position, group: p?.group ?? "", phone: p?.phone || d.phone || "" };
  });
  rows.sort(comparePersonnel(groups.map((g) => g.name)));

  return NextResponse.json({
    numbers,
    phones: rows.map(({ d, ...p }) => ({
      id: String(d._id),
      name: personnelLabel(p),
      phone: p.phone,
      kind: phoneKind(d.label),
      push: Boolean(d.push?.endpoint),
      apk: d.apk ?? null,
      bypass: bypassState(d.bypass, numbers),
      bypassAt: d.bypass?.at ?? null,
      testedAt: d.bypass?.testedAt ?? null,
      lastSeenAt: d.lastSeenAt ?? null,
    })),
  });
}

/** Яаралтай үед залгах дугаарууд. body: { numbers: string[] } — хоосон бол iPhone-ы заавар хэнд ч харагдахгүй */
export async function PUT(req: NextRequest) {
  const actor = await getActor();
  if (!actor || !isHrRole(actor.role)) return NextResponse.json(FORBIDDEN, { status: 403 });
  const parsed = parseBypassNumbers((await req.json().catch(() => null))?.numbers);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  await setBypassNumbers(parsed.value, actor.userId);
  return NextResponse.json({ numbers: parsed.value });
}
