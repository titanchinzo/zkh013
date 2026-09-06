import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/auth-role";

export default async function AdminUsersLayout({ children }: { children: React.ReactNode }) {
  const role = await getCurrentRole();
  if (role !== "admin") {
    redirect("/admin");
  }
  return children;
}
