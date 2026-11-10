import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentRole } from "@/lib/auth-role";
import { parseEmail, sendInvitation } from "@/lib/invite";
import { isRole } from "@/lib/roles";

/**
 * И-мэйлээр урилга илгээнэ. body: { email, role } — role "none" бол эрхгүй.
 * Урилгын холбоосоор бүртгүүлсэн хүн сонгосон эрхтэйгээ нэвтэрч, /app дээр бүртгэлээ шууд үүсгэнэ.
 */
export async function POST(req: NextRequest) {
  if ((await getCurrentRole()) !== "admin") {
    return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const email = parseEmail(body?.email);
  if (!email) return NextResponse.json({ error: "И-мэйл хаяг буруу байна." }, { status: 400 });
  // "none" — эрхгүй (зөвхөн утасны апп ашиглана)
  if (body?.role !== "none" && !isRole(body?.role)) {
    return NextResponse.json({ error: "Эрхээ сонгоно уу." }, { status: 400 });
  }

  const invitedBy = (await auth()).userId ?? "";
  const result = await sendInvitation(email, body.role === "none" ? { invitedBy } : { role: body.role, invitedBy });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
