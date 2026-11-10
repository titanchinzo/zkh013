import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import Personnel from "@/lib/models/Personnel";
import { getCurrentRole } from "@/lib/auth-role";
import { isHrRole } from "@/lib/roles";
import { personnelLabel } from "@/lib/hr";
import { parseEmail, sendInvitation } from "@/lib/invite";
import { pendingPersonnelInvitations } from "@/lib/invitation-list";

const FORBIDDEN = { error: "Зөвшөөрөлгүй" };

/** Алба хаагчдад илгээсэн, хариу хүлээж буй урилгууд (хэн урьсныг оролцуулан) */
export async function GET() {
  if (!isHrRole(await getCurrentRole())) return NextResponse.json(FORBIDDEN, { status: 403 });
  const pending = await pendingPersonnelInvitations();
  await connectToDatabase();
  const inviters = await Personnel.find({ userId: { $in: [...new Set(pending.map((p) => p.invitedBy))] } })
    .select("rank name userId")
    .lean<{ rank: string; name: string; userId: string }[]>();
  const nameOf = new Map(inviters.map((p) => [p.userId, personnelLabel(p)]));
  return NextResponse.json({
    invitations: pending.map((inv) => ({ ...inv, invitedByName: nameOf.get(inv.invitedBy) ?? "Хүний нөөц / админ" })),
  });
}

/**
 * Алба хаагчийг и-мэйлээр урина. body: { email, personnelId? } — personnelId өгвөл тэр хүн бүртгэлээ үүсгэхэд
 * хүний нөөцийн бүртгэлтэй (ирц, хуваарь) нь холбогдоно.
 */
export async function POST(req: NextRequest) {
  if (!isHrRole(await getCurrentRole())) return NextResponse.json(FORBIDDEN, { status: 403 });
  const body = await req.json().catch(() => null);
  const email = parseEmail(body?.email);
  if (!email) return NextResponse.json({ error: "И-мэйл хаяг буруу байна." }, { status: 400 });

  let personnelId: string | undefined;
  if (body?.personnelId) {
    await connectToDatabase();
    const person = isValidObjectId(body.personnelId) ? await Personnel.findById(body.personnelId).select("userId") : null;
    if (!person) return NextResponse.json({ error: "Алба хаагч олдсонгүй" }, { status: 400 });
    if (person.userId) return NextResponse.json({ error: "Энэ алба хаагч аль хэдийн бүртгэлтэй байна" }, { status: 409 });
    personnelId = String(person._id);
  }

  const invitedBy = (await auth()).userId ?? "";
  const result = await sendInvitation(email, personnelId ? { invitedBy, personnelId } : { invitedBy });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
