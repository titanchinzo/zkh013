import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getCurrentRole } from "@/lib/auth-role";

// Илгээсэн урилгыг цуцална — холбоос нь ажиллахаа болино
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if ((await getCurrentRole()) !== "admin") {
    return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  }

  const { id } = await params;
  const client = await clerkClient();
  await client.invitations.revokeInvitation(id);
  return NextResponse.json({ ok: true });
}
