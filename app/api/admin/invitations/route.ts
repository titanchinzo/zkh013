import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { getCurrentRole } from "@/lib/auth-role";
import { isRole } from "@/lib/roles";
import { SITE_URL } from "@/lib/site";

// Clerk-ийн алдааны кодыг ойлгомжтой болгоно
const CLERK_ERRORS: Record<string, string> = {
  form_identifier_exists: "Энэ и-мэйлтэй хэрэглэгч бүртгэлтэй байна. Доорх жагсаалтаас эрхийг нь сонгоно уу.",
  duplicate_record: "Энэ и-мэйл рүү урилга аль хэдийн илгээгдсэн байна.",
  form_param_format_invalid: "И-мэйл хаяг буруу байна.",
};

/**
 * И-мэйлээр урилга илгээнэ. body: { email, role }
 * Урилгын холбоосоор бүртгүүлсэн хүн сонгосон эрхтэйгээ шууд нэвтэрнэ (Clerk publicMetadata-д шилжинэ).
 */
export async function POST(req: NextRequest) {
  if ((await getCurrentRole()) !== "admin") {
    return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "И-мэйл хаяг буруу байна." }, { status: 400 });
  }
  if (!isRole(body?.role)) {
    return NextResponse.json({ error: "Эрхээ сонгоно уу." }, { status: 400 });
  }

  const client = await clerkClient();
  try {
    await client.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: { role: body.role },
      redirectUrl: `${SITE_URL}/sign-up`,
    });
  } catch (err) {
    if (isClerkAPIResponseError(err)) {
      const first = err.errors[0];
      const error = CLERK_ERRORS[first?.code] ?? first?.longMessage ?? first?.message ?? "Урилга илгээж чадсангүй";
      return NextResponse.json({ error }, { status: 400 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
