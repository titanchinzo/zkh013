export type Role = "admin" | "moderator" | "publisher" | "hr" | null;

export const ROLES = ["admin", "moderator", "publisher", "hr"] as const;

export const ROLE_LABELS: Record<NonNullable<Role>, string> = {
  admin: "Админ",
  moderator: "Хянагч",
  publisher: "Нийтлэгч",
  hr: "Хүний нөөц",
};

export function isRole(value: unknown): value is NonNullable<Role> {
  return ROLES.includes(value as NonNullable<Role>);
}

/** Мэдээг хянаж зөвшөөрөх, татгалзах эрхтэй эсэх (нийтлэгч зөвхөн мэдээ оруулна) */
export function canReview(role: Role) {
  return role === "admin" || role === "moderator";
}

/** Мэдээ оруулж, мэдээний ажлын жагсаалтыг харах эрхтэй эсэх (хүний нөөц мэдээтэй ажиллахгүй) */
export function isNewsRole(role: Role) {
  return role === "admin" || role === "moderator" || role === "publisher";
}

/** Алба хаагчдын ирц, харуул, манаа, утасны бүртгэл, зарлан мэдээллийг удирдах эрх — нийтэд биш */
export function isHrRole(role: Role) {
  return role === "admin" || role === "hr";
}

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
  if (isRole(role)) return role;

  const initialAdmins = (process.env.INITIAL_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (email && initialAdmins.includes(email.toLowerCase())) return "admin";

  return null;
}
