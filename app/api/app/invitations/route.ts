import { NextRequest, NextResponse } from "next/server";
import { getApprovedDevice } from "@/lib/device";
import Personnel from "@/lib/models/Personnel";
import { parseEmail, sendInvitation } from "@/lib/invite";
import { pendingPersonnelInvitations } from "@/lib/invitation-list";

// Нэг даргын нэгэн зэрэг хариу хүлээж болох урилгын дээд тоо
const MAX_PENDING = 50;

/** Хүний нөөцөөс «Бүртгэх эрх» авсан дарга — доод хүмүүсээ урьж бүртгэнэ (утсан дээрх апп) */
async function registrar() {
  const device = await getApprovedDevice();
  if (!device) return null;
  const allowed = await Personnel.exists({ userId: device.userId, active: true, canRegister: true });
  return allowed ? device.userId : null;
}

/** Миний урьсан хүмүүс: хариу хүлээж буй урилга, бүртгэлээ үүсгэсэн хүмүүс */
export async function GET() {
  const userId = await registrar();
  if (!userId) return NextResponse.json({ error: "Танд бүртгэх эрх байхгүй" }, { status: 403 });
  const [pending, joined] = await Promise.all([
    pendingPersonnelInvitations(userId),
    Personnel.find({ invitedBy: userId }).sort({ createdAt: -1 }).select("rank name position phone photo").lean(),
  ]);
  return NextResponse.json({ pending: pending.map(({ id, email, createdAt }) => ({ id, email, createdAt })), joined });
}

/** Хүн урих. body: { email } — урилгаар орж ирсэн хүн бүртгэлээ шууд үүсгэнэ (хүний нөөцийн зөвшөөрөлгүй) */
export async function POST(req: NextRequest) {
  const userId = await registrar();
  if (!userId) return NextResponse.json({ error: "Танд бүртгэх эрх байхгүй" }, { status: 403 });
  const email = parseEmail((await req.json().catch(() => null))?.email);
  if (!email) return NextResponse.json({ error: "И-мэйл хаяг буруу байна." }, { status: 400 });
  if ((await pendingPersonnelInvitations(userId)).length >= MAX_PENDING) {
    return NextResponse.json({ error: `Хариу хүлээж буй урилга ${MAX_PENDING}-аас олон байж болохгүй` }, { status: 400 });
  }
  const result = await sendInvitation(email, { invitedBy: userId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
