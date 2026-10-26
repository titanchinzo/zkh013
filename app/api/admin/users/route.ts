import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getCurrentRole } from "@/lib/auth-role";
import { isRole, resolveRole } from "@/lib/roles";

export async function GET() {
  const role = await getCurrentRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  }

  const client = await clerkClient();
  const [{ data }, { data: pending }, { userId }] = await Promise.all([
    client.users.getUserList({ limit: 100 }),
    client.invitations.getInvitationList({ status: "pending", limit: 100 }),
    auth(),
  ]);

  const users = data.map((u) => ({
    id: u.id,
    name: u.fullName ?? u.username ?? "Тодорхойгүй",
    email: u.primaryEmailAddress?.emailAddress ?? "",
    role: resolveRole(u.publicMetadata as { role?: string }, u.primaryEmailAddress?.emailAddress),
    isMe: u.id === userId,
  }));

  // Урилга илгээсэн боловч хараахан бүртгүүлээгүй хүмүүс
  const invitations = pending.map((inv) => {
    const invitedRole = inv.publicMetadata?.role;
    return { id: inv.id, email: inv.emailAddress, role: isRole(invitedRole) ? invitedRole : null, createdAt: inv.createdAt };
  });

  return NextResponse.json({ users, invitations });
}
