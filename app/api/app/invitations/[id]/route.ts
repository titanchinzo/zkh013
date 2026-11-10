import { NextRequest, NextResponse } from "next/server";
import { getApprovedDevice } from "@/lib/device";
import Personnel from "@/lib/models/Personnel";
import { pendingPersonnelInvitations, revokeInvitation } from "@/lib/invitation-list";

/** Өөрийн илгээсэн урилгыг цуцлах */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const device = await getApprovedDevice();
  const allowed = device && (await Personnel.exists({ userId: device.userId, active: true, canRegister: true }));
  if (!device || !allowed) return NextResponse.json({ error: "Танд бүртгэх эрх байхгүй" }, { status: 403 });
  const { id } = await params;
  const mine = (await pendingPersonnelInvitations(device.userId)).some((inv) => inv.id === id);
  if (!mine) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  await revokeInvitation(id);
  return NextResponse.json({ ok: true });
}
