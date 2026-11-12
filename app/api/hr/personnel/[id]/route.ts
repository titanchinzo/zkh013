import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import ChatDeletion from "@/lib/models/ChatDeletion";
import ChatMessage from "@/lib/models/ChatMessage";
import DayRecord from "@/lib/models/DayRecord";
import Device from "@/lib/models/Device";
import Personnel from "@/lib/models/Personnel";
import { getCurrentRole } from "@/lib/auth-role";
import { isHrRole } from "@/lib/roles";
import { parsePersonnel } from "@/lib/hr";
import { deleteFile } from "@/lib/storage";
import { pendingPersonnelInvitations, revokeInvitation } from "@/lib/invitation-list";
import { ensureGroups } from "@/lib/personnel-groups";
import { deleteChatFilesOf } from "@/lib/chat-files";

type Params = { params: Promise<{ id: string }> };

/**
 * Алба хаагчийн мэдээллийг засах (үг үсгийн алдаа г.м). body: { rank?, name?, position?, phone?, group?,
 * extraPhones?, emergencyPhone?, active?, canRegister?, photo: null } — active: false — халагдсан хүнийг түүхтэй нь
 * үлдээж идэвхгүй болгоно; photo: null — зургийг нь арилгана; canRegister — «Бүртгэх эрх» (доод хүмүүсээ урьж бүртгэх).
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  if (!isHrRole(await getCurrentRole())) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });

  await connectToDatabase();
  const person = await Personnel.findById(id);
  if (!person) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  const body = await req.json().catch(() => null);
  // Жагсаалтаас дугааргүй орж ирсэн хүнийг дугааргүйгээр засаж болно
  const parsed = parsePersonnel(body, { partial: true, keepRank: person.rank, phoneOptional: !person.phone, hr: true });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const oldPhoto = body?.photo === null ? person.photo : "";
  person.set({
    ...parsed.value,
    ...(typeof body?.active === "boolean" ? { active: body.active } : {}),
    ...(typeof body?.canRegister === "boolean" ? { canRegister: body.canRegister } : {}),
    ...(body?.photo === null ? { photo: "" } : {}),
  });
  await person.save();
  if (parsed.value.group) await ensureGroups([parsed.value.group]);
  if (oldPhoto) await deleteFile(oldPhoto).catch(() => {});
  return NextResponse.json({ person });
}

/**
 * Алба хаагчийг бүр мөсөн устгана: ирц, харуулын хуваарийн бүх өдрөөс хасаж, профайл зургийг нь устгана. Апп-д
 * холбогдсон бол утсыг нь хүчингүй болгож (дахин бүртгүүлэхэд хүний нөөц зөвшөөрнө), түүнд ирсэн чатын зурвасыг
 * устгана. Түүний илгээсэн болон түүний бүртгэлтэй холбохоор илгээсэн хүлээгдэж буй урилгыг цуцална.
 * Сайтын бүртгэл (Clerk) нь үлдэнэ — түүнийг админ «Хэрэглэгчид» хэсгээс устгана.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!isHrRole(await getCurrentRole())) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });

  await connectToDatabase();
  const person = await Personnel.findById(id);
  if (!person) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  const userId: string | undefined = person.userId;

  await DayRecord.updateMany(
    { $or: [{ guard: person._id }, { watch: person._id }, { reminded: person._id }, { "attendance.personnel": person._id }] },
    { $pull: { guard: person._id, watch: person._id, reminded: person._id, attendance: { personnel: person._id } } }
  );
  if (userId) {
    const decidedBy = (await auth()).userId ?? "";
    await Device.updateMany(
      { userId, status: { $in: ["approved", "pending"] } },
      { $set: { status: "revoked", decidedBy, decidedAt: new Date() }, $unset: { push: 1 } }
    );
    await ChatMessage.deleteMany({ recipient: userId });
    await ChatDeletion.deleteMany({ recipient: userId });
    // Түүний илгээсэн, түүнд ирсэн чатын файлууд (серверийн хувийн хавтсаас)
    await deleteChatFilesOf(userId);
  }
  try {
    const invitations = await pendingPersonnelInvitations();
    const stale = invitations.filter((inv) => (userId && inv.invitedBy === userId) || inv.personnelId === id);
    await Promise.all(stale.map((inv) => revokeInvitation(inv.id)));
  } catch (err) {
    console.error("[personnel] урилгыг цуцалж чадсангүй:", err);
  }

  await person.deleteOne();
  if (person.photo) await deleteFile(person.photo).catch(() => {});
  return NextResponse.json({ ok: true });
}
