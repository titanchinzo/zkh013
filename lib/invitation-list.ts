import "server-only";
import { clerkClient } from "@clerk/nextjs/server";

// personnelId — хүний нөөц урьдчилж бүртгэсэн алба хаагчтай холбохоор илгээсэн урилга
export type PendingInvitation = { id: string; email: string; invitedBy: string; personnelId?: string; createdAt: number };

/** Хариу хүлээж буй, алба хаагчид илгээсэн (эрхгүй) урилгууд; invitedBy өгвөл зөвхөн тэр хүний урьсныг */
export async function pendingPersonnelInvitations(invitedBy?: string): Promise<PendingInvitation[]> {
  const client = await clerkClient();
  const { data } = await client.invitations.getInvitationList({ status: "pending", limit: 500 });
  const list: PendingInvitation[] = [];
  for (const inv of data) {
    const meta = inv.publicMetadata ?? {};
    if (meta.role || typeof meta.invitedBy !== "string") continue;
    if (invitedBy && meta.invitedBy !== invitedBy) continue;
    list.push({
      id: inv.id,
      email: inv.emailAddress,
      invitedBy: meta.invitedBy,
      ...(typeof meta.personnelId === "string" ? { personnelId: meta.personnelId } : {}),
      createdAt: inv.createdAt,
    });
  }
  return list;
}

export async function revokeInvitation(id: string) {
  const client = await clerkClient();
  await client.invitations.revokeInvitation(id);
}
