import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getCurrentRole } from "@/lib/auth-role";

/**
 * Админ: «Ахмад» эрх олгох / хасах. body: { ahmad: boolean } — сайтын «Ахмад» хэсэгт пост бичнэ (хянагч зөвшөөрнө).
 * Clerk-ийн publicMetadata-д бусад утгыг (role г.м) хэвээр үлдээж нэмнэ (null бол хасна).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if ((await getCurrentRole()) !== "admin") return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  const { id } = await params;
  const ahmad = (await req.json().catch(() => null))?.ahmad;
  if (typeof ahmad !== "boolean") return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });

  const client = await clerkClient();
  await client.users.updateUserMetadata(id, { publicMetadata: { ahmad: ahmad ? true : null } });
  return NextResponse.json({ ok: true });
}
