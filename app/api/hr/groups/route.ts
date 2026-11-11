import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Personnel from "@/lib/models/Personnel";
import PersonnelGroup from "@/lib/models/PersonnelGroup";
import { getCurrentRole } from "@/lib/auth-role";
import { isHrRole } from "@/lib/roles";
import { PERSONNEL_LIMITS } from "@/lib/hr";
import { ensureGroups } from "@/lib/personnel-groups";

const FORBIDDEN = { error: "Зөвшөөрөлгүй" };
const cleanName = (value: unknown) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "");

/** Бүлгүүдийн дараалал. body: { order: string[] } — жагсаалтад байгаа бүлгүүд энэ дарааллаар */
export async function PUT(req: NextRequest) {
  if (!isHrRole(await getCurrentRole())) return NextResponse.json(FORBIDDEN, { status: 403 });
  const body = await req.json().catch(() => null);
  const order = Array.isArray(body?.order) ? [...new Set(body.order.map(cleanName).filter(Boolean))] : [];
  if (!order.length || order.length > 500 || order.some((n) => (n as string).length > PERSONNEL_LIMITS.group)) {
    return NextResponse.json({ error: "Дараалал буруу" }, { status: 400 });
  }
  await connectToDatabase();
  await PersonnelGroup.bulkWrite(
    order.map((name, i) => ({ updateOne: { filter: { name }, update: { $set: { order: i + 1 } }, upsert: true } }))
  );
  return NextResponse.json({ ok: true });
}

/**
 * Бүлгийн нэрийг солино (байгаа бүлгийн нэр өгвөл нийлүүлнэ): body: { from, to }.
 * Эсвэл бүлгийнхэн бүх хүний утасны жагсаалтыг харах эсэх: body: { name, seesAll }.
 */
export async function PATCH(req: NextRequest) {
  if (!isHrRole(await getCurrentRole())) return NextResponse.json(FORBIDDEN, { status: 403 });
  const body = await req.json().catch(() => null);
  if (typeof body?.seesAll === "boolean") {
    const name = cleanName(body?.name);
    if (!name) return NextResponse.json({ error: "Бүлгийн нэрийг бичнэ үү" }, { status: 400 });
    await connectToDatabase();
    await ensureGroups([name]);
    await PersonnelGroup.updateOne({ name }, { $set: { seesAll: body.seesAll } });
    return NextResponse.json({ ok: true });
  }
  const from = cleanName(body?.from);
  const to = cleanName(body?.to);
  if (!from || !to) return NextResponse.json({ error: "Бүлгийн нэрийг бичнэ үү" }, { status: 400 });
  if (to.length > PERSONNEL_LIMITS.group) return NextResponse.json({ error: "Хэт урт нэр" }, { status: 400 });
  if (from === to) return NextResponse.json({ ok: true });

  await connectToDatabase();
  const { modifiedCount } = await Personnel.updateMany({ group: from }, { $set: { group: to } });
  if (await PersonnelGroup.exists({ name: to })) await PersonnelGroup.deleteOne({ name: from });
  else await PersonnelGroup.updateOne({ name: from }, { $set: { name: to } }, { upsert: true });
  return NextResponse.json({ ok: true, moved: modifiedCount });
}
