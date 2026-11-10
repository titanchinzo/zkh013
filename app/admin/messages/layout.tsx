import { requireAdmin } from "@/lib/admin-guard";

export default async function AdminMessagesLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}
