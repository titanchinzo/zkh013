import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Personnel from "@/lib/models/Personnel";
import { getCurrentRole } from "@/lib/auth-role";
import { isHrRole } from "@/lib/roles";
import { ensureGroups } from "@/lib/personnel-groups";
import { IMPORT_LIMITS, parseRoster, planImport, type ExistingPerson } from "@/lib/personnel-import";

/**
 * Алба хаагчдын жагсаалтаас (ангийн утасны жагсаалт г.м) бүлгээр нь бүртгэнэ. body: { text, commit? }
 * commit: true биш бол юу болохыг л харуулна (шинэ, шинэчлэх, өөрчлөлтгүй, анхааруулга). Өмнөх бүртгэлтэй хүн
 * утасны дугаар эсвэл нэрээр нь танигдаж шинэчлэгдэнэ — давхардахгүй. Нэрийг нь хэвээр үлдээнэ.
 */
export async function POST(req: NextRequest) {
  if (!isHrRole(await getCurrentRole())) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text : "";
  if (!text.trim()) return NextResponse.json({ error: "Жагсаалтаа оруулна уу" }, { status: 400 });
  if (text.length > IMPORT_LIMITS.chars) return NextResponse.json({ error: "Жагсаалт хэт том байна" }, { status: 400 });

  const { rows, groups } = parseRoster(text);
  if (!rows.length) {
    return NextResponse.json(
      { error: "Алба хаагч олдсонгүй. Мөр бүр: д/д, цол, нэр, өөрийн дугаар, шаардлагатай үед (табаар эсвэл таслалаар)." },
      { status: 400 }
    );
  }
  if (rows.length > IMPORT_LIMITS.rows) return NextResponse.json({ error: "Хэт олон мөр байна" }, { status: 400 });

  await connectToDatabase();
  const existing = await Personnel.find()
    .select("rank name position phone extraPhones emergencyPhone group active")
    .lean<(Omit<ExistingPerson, "_id"> & { _id: unknown })[]>();
  const planned = planImport(
    rows,
    existing.map((p) => ({ ...p, _id: String(p._id) }))
  );

  let committed = false;
  if (body?.commit === true) {
    await ensureGroups(groups);
    const creates = planned.filter((r) => r.action === "create");
    if (creates.length) {
      await Personnel.insertMany(
        creates.map((r) => ({
          rank: r.rank,
          name: r.name,
          position: r.position,
          phone: r.phones[0] ?? "",
          extraPhones: r.phones.slice(1),
          emergencyPhone: r.emergencyPhone,
          group: r.group,
          active: true,
        }))
      );
    }
    const updates = planned.filter((r) => r.action === "update" && r.match);
    if (updates.length) {
      const current = new Map(existing.map((p) => [String(p._id), p]));
      await Personnel.bulkWrite(
        updates.map((r) => {
          const before = current.get(r.match!.id)!;
          return {
            updateOne: {
              filter: { _id: r.match!.id },
              update: {
                $set: {
                  active: true,
                  ...(r.group ? { group: r.group } : {}),
                  ...(r.rank ? { rank: r.rank } : {}),
                  ...(r.phones.length ? { phone: r.phones[0], extraPhones: r.phones.slice(1) } : {}),
                  ...(r.emergencyPhone ? { emergencyPhone: r.emergencyPhone } : {}),
                  ...(r.position && !before.position ? { position: r.position } : {}),
                },
              },
            },
          };
        })
      );
    }
    committed = true;
  }

  const count = (action: string) => planned.filter((r) => r.action === action).length;
  return NextResponse.json({
    committed,
    summary: { total: planned.length, create: count("create"), update: count("update"), same: count("same"), groups: groups.length },
    groups: groups.map((name) => ({ name, count: planned.filter((r) => r.group === name).length })),
    rows: planned,
  });
}
