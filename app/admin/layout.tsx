import { redirect } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { getCurrentRole } from "@/lib/auth-role";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const role = await getCurrentRole();

  if (!role) {
    redirect("/");
  }

  const links = [
    { href: "/admin", label: "Хянах самбар" },
    { href: "/admin/news", label: role === "admin" ? "Мэдээ удирдах" : "Хянах жагсаалт" },
    ...(role === "admin"
      ? [
          { href: "/admin/training", label: "Сургалтын материал" },
          { href: "/admin/users", label: "Хэрэглэгч, эрх" },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-64 shrink-0 border-r border-border bg-card flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <span className="font-bold tracking-widest">
            <span className="text-primary">013</span> ADMIN
          </span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">
            {role === "admin" ? "Админ" : "Хянагч"}
          </span>
          <UserButton />
        </div>
        <Link href="/" className="p-4 text-xs text-muted-foreground hover:text-primary border-t border-border">
          ← Сайт руу буцах
        </Link>
      </aside>
      <main className="flex-1 p-8 overflow-y-auto">{children}</main>
    </div>
  );
}
