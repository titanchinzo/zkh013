import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getCurrentRole } from "@/lib/auth-role";
import { resolveRole } from "@/lib/roles";

export async function GET() {
  const role = await getCurrentRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  }

  const client = await clerkClient();
  const { data } = await client.users.getUserList({ limit: 100 });

  const users = data.map((u) => ({
    id: u.id,
    name: u.fullName ?? u.username ?? "Тодорхойгүй",
    email: u.primaryEmailAddress?.emailAddress ?? "",
    role: resolveRole(u.publicMetadata as { role?: string }, u.primaryEmailAddress?.emailAddress),
  }));

  return NextResponse.json({ users });
}
