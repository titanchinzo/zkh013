import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getCurrentRole } from "@/lib/auth-role";
import { isRole } from "@/lib/roles";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = await getCurrentRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  }

  const { id } = await params;
  const { role: newRole } = await req.json();

  if (newRole !== "none" && !isRole(newRole)) {
    return NextResponse.json({ error: "Буруу role" }, { status: 400 });
  }
  // Админ өөрийн эрхийг андуурч хасаад самбараас гарахгүйн тулд
  if (id === (await auth()).userId) {
    return NextResponse.json({ error: "Өөрийн эрхийг өөрчлөх боломжгүй" }, { status: 400 });
  }

  const client = await clerkClient();
  await client.users.updateUserMetadata(id, {
    publicMetadata: { role: newRole === "none" ? null : newRole },
  });

  return NextResponse.json({ ok: true });
}
