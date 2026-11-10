import { NextRequest, NextResponse } from "next/server";
import { getApprovedDevice } from "@/lib/device";
import Personnel from "@/lib/models/Personnel";
import { parsePersonnel } from "@/lib/hr";

/** Өөрийн бүртгэлийг засах (утсан дээрх апп). body: { rank?, name?, position?, phone? } — хүний нөөц ч засаж болно */
export async function PATCH(req: NextRequest) {
  const device = await getApprovedDevice();
  if (!device) return NextResponse.json({ error: "Энэ утсыг хүний нөөц зөвшөөрөөгүй байна" }, { status: 403 });
  const person = await Personnel.findOne({ userId: device.userId });
  if (!person) return NextResponse.json({ error: "Бүртгэл олдсонгүй" }, { status: 404 });

  const parsed = parsePersonnel(await req.json().catch(() => null), true, person.rank);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  person.set(parsed.value);
  await person.save();
  return NextResponse.json({ ok: true });
}
