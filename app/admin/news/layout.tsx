import { requireNewsRole } from "@/lib/admin-guard";

export default async function AdminNewsLayout({ children }: { children: React.ReactNode }) {
  await requireNewsRole();
  return children;
}
