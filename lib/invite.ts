import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { resolveRole } from "@/lib/roles";
import { SITE_URL } from "@/lib/site";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Clerk-ийн алдааны кодыг ойлгомжтой болгоно
const CLERK_ERRORS: Record<string, string> = {
  form_identifier_exists: "Энэ и-мэйлтэй хэрэглэгч бүртгэлтэй байна.",
  duplicate_record: "Энэ и-мэйл рүү урилга аль хэдийн илгээгдсэн байна.",
  form_param_format_invalid: "И-мэйл хаяг буруу байна.",
};

export function parseEmail(value: unknown): string | null {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return EMAIL_PATTERN.test(email) ? email : null;
}

/** Clerk-ийн алдааг монгол хэлээр; Clerk-ийн алдаа биш бол null */
export function clerkErrorMessage(err: unknown, fallback: string): string | null {
  if (!isClerkAPIResponseError(err)) return null;
  const first = err.errors[0];
  return CLERK_ERRORS[first?.code] ?? first?.longMessage ?? first?.message ?? fallback;
}

/**
 * Урилгын тэмдэглэл (Clerk publicMetadata-д хадгалагдана): invitedBy — урьсан хүн, personnelId — хүний нөөцөд
 * аль хэдийн бүртгэлтэй алба хаагчтай холбох бол.
 */
export type InviteMetadata = { role?: string; invitedBy: string; personnelId?: string };

/**
 * И-мэйлээр урилга илгээнэ. Урилгаар бүртгүүлсэн хүн /app дээр хүний нөөцийн зөвшөөрөл хүлээлгүй бүртгэлээ
 * шууд үүсгэж, апп татна — урьсан хүн нь баталгаа болно.
 */
export async function sendInvitation(email: string, metadata: InviteMetadata) {
  const client = await clerkClient();
  try {
    await client.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: metadata,
      redirectUrl: `${SITE_URL}/sign-up?redirect_url=${encodeURIComponent("/app")}`,
    });
    return { ok: true as const };
  } catch (err) {
    const error = clerkErrorMessage(err, "Урилга илгээж чадсангүй");
    if (error) return { ok: false as const, error };
    throw err;
  }
}

/**
 * Урилгаар орж ирсэн, эсвэл админ эрх олгосон (баталгаатай) хэрэглэгч бол урьсан хүнийг буцаана —
 * ийм хүний анхны утас хүний нөөцийн зөвшөөрөлгүй шууд идэвхжинэ.
 */
export function trustOf(user: {
  publicMetadata: unknown;
  primaryEmailAddress?: { emailAddress: string } | null;
}): { invitedBy: string; personnelId?: string } | null {
  const m = (user.publicMetadata ?? {}) as Record<string, unknown>;
  if (typeof m.invitedBy === "string" && m.invitedBy) {
    return { invitedBy: m.invitedBy, personnelId: typeof m.personnelId === "string" ? m.personnelId : undefined };
  }
  const role = resolveRole(m as { role?: string }, user.primaryEmailAddress?.emailAddress);
  return role ? { invitedBy: "role" } : null;
}
