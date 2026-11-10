import { requireHrRole } from "@/lib/admin-guard";

// Хүний нөөцийн хуудсууд нийтэд биш — зөвхөн админ, хүний нөөц
export default async function HrLayout({ children }: { children: React.ReactNode }) {
  await requireHrRole();
  return children;
}
