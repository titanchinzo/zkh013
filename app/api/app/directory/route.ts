import { NextResponse } from "next/server";
import { getApprovedDevice } from "@/lib/device";
import { userRole } from "@/lib/actor";
import Personnel from "@/lib/models/Personnel";
import { comparePersonnel } from "@/lib/hr";
import { groupSeesAll, listGroups } from "@/lib/personnel-groups";

type PersonDoc = {
  _id: unknown;
  rank: string;
  name: string;
  position: string;
  group?: string;
  phone?: string;
  extraPhones?: string[];
  emergencyPhone?: string;
  userId?: string;
};

/**
 * Утсан дээрх аппын утасны жагсаалт. Хүн бүр өөрийн бүлгийнхний утсыг харна. «Бүх утас харна» тохиргоотой бүлгийнхэн
 * (захирагч, орлогч нар), хүний нөөц, админ бүх идэвхтэй алба хаагчийн утсыг (шаардлагатай үеийн дугаартай нь)
 * бүлэг бүрээр харна.
 */
export async function GET() {
  const device = await getApprovedDevice();
  if (!device) return NextResponse.json({ error: "Энэ утсыг хүний нөөц зөвшөөрөөгүй байна" }, { status: 403 });
  const me = await Personnel.findOne({ userId: device.userId, active: true }).select("group").lean<{ group?: string }>();
  if (!me) return NextResponse.json({ error: "Таны бүртгэл идэвхгүй байна" }, { status: 403 });

  const { role } = await userRole(device.userId);
  const all = role === "admin" || role === "hr" || (await groupSeesAll(me.group));
  if (!all && !me.group) {
    return NextResponse.json({ scope: "group", group: "", groups: [] });
  }

  const [people, groups] = await Promise.all([
    Personnel.find({ active: true, ...(all ? {} : { group: me.group }) })
      .select("rank name position group phone extraPhones emergencyPhone userId")
      .lean<PersonDoc[]>(),
    listGroups(),
  ]);
  const order = groups.map((g) => g.name);
  people.sort(comparePersonnel(order));

  const sections = new Map<string, unknown[]>();
  for (const p of people) {
    const key = p.group ?? "";
    sections.set(key, [
      ...(sections.get(key) ?? []),
      {
        id: String(p._id),
        rank: p.rank,
        name: p.name,
        position: p.position,
        phones: [p.phone, ...(p.extraPhones ?? [])].filter(Boolean),
        // «Шаардлагатай үед» (гэр бүл г.м) — зөвхөн бүх жагсаалтыг харах эрхтэй хүнд
        ...(all && p.emergencyPhone ? { emergencyPhone: p.emergencyPhone } : {}),
        me: p.userId === device.userId,
      },
    ]);
  }

  return NextResponse.json({
    scope: all ? "all" : "group",
    group: me.group ?? "",
    groups: [...sections].map(([name, list]) => ({ name, people: list })),
  });
}
