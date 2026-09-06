import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

const links = [
  { href: "#hero", label: "Нүүр" },
  { href: "#about", label: "Тухай" },
  { href: "#equipment", label: "Техник" },
  { href: "#training", label: "Сургалт" },
  { href: "/news", label: "Мэдээ" },
  { href: "#contact", label: "Холбоо барих" },
];

export async function Nav() {
  const { userId } = await auth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="#hero" className="flex items-center gap-2 font-bold tracking-widest text-foreground">
            <span className="text-primary">013</span> АНГИ
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                {link.label}
              </Link>
            ))}
            {userId ? (
              <>
                <Link
                  href="/admin"
                  className="ml-2 px-4 py-2 text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-md transition-all"
                >
                  Админ
                </Link>
                <div className="ml-2">
                  <UserButton />
                </div>
              </>
            ) : (
              <Link
                href="/sign-in"
                className="ml-2 px-4 py-2 text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-md transition-all"
              >
                Админ
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
