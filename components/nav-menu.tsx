"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string };

/** Цэсний холбоосууд: том дэлгэцэнд мөрөөр, гар утсанд ☰ товчоор нээгдэнэ */
export function NavMenu({ links, showAdmin }: { links: NavLink[]; showAdmin: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : !href.includes("#") && pathname.startsWith(href);

  return (
    <>
      <div className="hidden md:flex items-center gap-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "px-3 py-2 text-sm font-medium transition-colors hover:text-primary",
              isActive(link.href) ? "text-primary" : "text-muted-foreground"
            )}
          >
            {link.label}
          </Link>
        ))}
        {showAdmin && (
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
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Цэс хаах" : "Цэс нээх"}
        className="md:hidden -mr-2 flex h-10 w-10 items-center justify-center rounded-md text-foreground hover:bg-muted"
      >
        {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {open && (
        <div className="md:hidden absolute inset-x-0 top-16 border-b border-border bg-background shadow-xl shadow-black/50">
          <div className="container mx-auto flex flex-col px-4 py-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "border-b border-border/60 py-3 text-base font-medium last:border-0",
                  isActive(link.href) ? "text-primary" : "text-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
            {showAdmin && (
              <div className="flex items-center justify-between py-3">
                <Link href="/admin" onClick={() => setOpen(false)} className="text-base font-medium text-primary">
                  Админ
                </Link>
                <UserButton />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
