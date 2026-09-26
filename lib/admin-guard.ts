import "server-only";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/auth-role";

/** Зөвхөн админд зориулсан хуудсанд: бусад эрхтэй бол хянах самбар руу буцаана */
export async function requireAdmin() {
  if ((await getCurrentRole()) !== "admin") redirect("/admin");
}
