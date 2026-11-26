import { NextResponse } from "next/server";
import { getApprovedDevice } from "@/lib/device";
import { userRole } from "@/lib/actor";
import Personnel from "@/lib/models/Personnel";
import { comparePersonnel } from "@/lib/hr";
import { listGroups } from "@/lib/personnel-groups";

type PersonDoc = {
  _id: unknown;
  rank: string;
  name: string;
  position: string;
  group?: string;
  phone?: string;
  extraPhones?: string[];
  emergencyPhone?: string;
  hidePhone?: boolean;
  userId?: string;
};

type Entry = {
  id: string;
  rank: string;
  name: string;
  position: string;
  phones: string[];
  hidden?: true;
  emergencyPhone?: string;
  me: boolean;
};

/**
 * Утсан дээрх аппын утасны жагсаалт: ангийн бүх идэвхтэй алба хаагч бүлэг бүрээр, өөрийн бүлэг нь эхэндээ.
 * «Дугаар нууц» хүний (захирагч, орлогч нарын бүлэг анхнаасаа; хүний нөөц бүлгээр эсвэл хүн тус бүрээр нууцална)
 * дугаарыг зөвхөн «Бүх утас харна» эрхтэй хүн (тийм бүлгийнхэн — захирагч, орлогч нар анхнаасаа; тус бүрд нь олгосон
 * хүн; хүний нөөц, админ) болон өөрийн бүлгийнхэн нь харна — бусдад «Дугаар нууц» гэж харагдана. «Шаардлагатай үед»
 * дугаар (гэр бүл г.м) зөвхөн «Бүх утас харна» эрхтэй хүнд.
 */
export async function GET() {
  const device = await getApprovedDevice();
  if (!device) return NextResponse.json({ error: "Энэ утсыг хүний нөөц зөвшөөрөөгүй байна" }, { status: 403 });
  const me = await Personnel.findOne({ userId: device.userId, active: true })
    .select("group seesAllPhones")
    .lean<{ group?: string; seesAllPhones?: boolean }>();
  if (!me) return NextResponse.json({ error: "Таны бүртгэл идэвхгүй байна" }, { status: 403 });

  const [{ role }, groups, people] = await Promise.all([
    userRole(device.userId),
    listGroups(),
    Personnel.find({ active: true })
      .select("rank name position group phone extraPhones emergencyPhone hidePhone userId")
      .lean<PersonDoc[]>(),
  ]);
  const myGroup = me.group ?? "";
  const flags = new Map(groups.map((g) => [g.name, g]));
  const all = role === "admin" || role === "hr" || Boolean(me.seesAllPhones) || Boolean(flags.get(myGroup)?.seesAll);
  const isMe = (p: PersonDoc) => p.userId === device.userId;
  const secret = (p: PersonDoc) =>
    !all &&
    !isMe(p) &&
    !(myGroup && p.group === myGroup) &&
    (Boolean(p.hidePhone) || Boolean(p.group && flags.get(p.group)?.hidesPhones));
  people.sort(comparePersonnel(groups.map((g) => g.name)));

  // Өөрийн бүлэг эхэндээ, бусад нь ангийн бүтцийн дарааллаар
  const sections = new Map<string, Entry[]>(myGroup ? [[myGroup, []]] : []);
  for (const p of people) {
    const key = p.group ?? "";
    const list = sections.get(key) ?? [];
    const hidden = secret(p);
    list.push({
      id: String(p._id),
      rank: p.rank,
      name: p.name,
      position: p.position,
      phones: hidden ? [] : [p.phone, ...(p.extraPhones ?? [])].filter((phone): phone is string => Boolean(phone)),
      ...(hidden ? { hidden: true as const } : {}),
      // «Шаардлагатай үед» (гэр бүл г.м) — зөвхөн «Бүх утас харна» эрхтэй хүнд
      ...(all && p.emergencyPhone ? { emergencyPhone: p.emergencyPhone } : {}),
      me: isMe(p),
    });
    sections.set(key, list);
  }

  return NextResponse.json({
    scope: all ? "all" : "unit",
    group: myGroup,
    groups: [...sections].filter(([, list]) => list.length).map(([name, list]) => ({ name, people: list })),
  });
}
