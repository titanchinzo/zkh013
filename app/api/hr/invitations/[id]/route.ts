import { NextRequest, NextResponse } from "next/server";
import { getCurrentRole } from "@/lib/auth-role";
import { isHrRole } from "@/lib/roles";
import { pendingPersonnelInvitations, revokeInvitation } from "@/lib/invitation-list";

/** Алба хаагчид илгээсэн урилгыг цуцлах (эрхтэй ажилтны урилгыг зөвхөн админ цуцална) */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isHrRole(await getCurrentRole())) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  const { id } = await params;
  if (!(await pendingPersonnelInvitations()).some((inv) => inv.id === id)) {
    return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  }
  await revokeInvitation(id);
  return NextResponse.json({ ok: true });
}
