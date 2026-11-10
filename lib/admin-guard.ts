import "server-only";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/auth-role";
import { isHrRole, isNewsRole } from "@/lib/roles";

/** Зөвхөн админд зориулсан хуудсанд: бусад эрхтэй бол хянах самбар руу буцаана */
export async function requireAdmin() {
  if ((await getCurrentRole()) !== "admin") redirect("/admin");
}

/** Мэдээний хуудсууд — админ, хянагч, нийтлэгч */
export async function requireNewsRole() {
  if (!isNewsRole(await getCurrentRole())) redirect("/admin");
}

/** Ирц, алба хаагчид, утасны бүртгэл, зарлан мэдээлэх — зөвхөн админ, хүний нөөц */
export async function requireHrRole() {
  if (!isHrRole(await getCurrentRole())) redirect("/admin");
}
