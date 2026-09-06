import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getCurrentRole } from "@/lib/auth-role";

const VALID_ROLES = ["admin", "moderator", "none"] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = await getCurrentRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  }

  const { id } = await params;
  const { role: newRole } = await req.json();

  if (!VALID_ROLES.includes(newRole)) {
    return NextResponse.json({ error: "Буруу role" }, { status: 400 });
  }

  const client = await clerkClient();
  await client.users.updateUserMetadata(id, {
    publicMetadata: { role: newRole === "none" ? null : newRole },
  });

  return NextResponse.json({ ok: true });
}
