export type Role = "admin" | "moderator" | null;

type ClerkPublicMetadata = { role?: string };

/**
 * Эхний админыг гараар Clerk дээр тохируулах хэрэггүй байхын тулд
 * .env дэх INITIAL_ADMIN_EMAILS жагсаалтад байгаа и-мэйлтэй хэрэглэгчийг
 * publicMetadata.role тохируулаагүй ч гэсэн admin гэж үзнэ.
 */
export function resolveRole(
  publicMetadata: ClerkPublicMetadata | undefined,
  email: string | undefined | null
): Role {
  const role = publicMetadata?.role;
  if (role === "admin" || role === "moderator") return role;

  const initialAdmins = (process.env.INITIAL_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (email && initialAdmins.includes(email.toLowerCase())) return "admin";

  return null;
}
