"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Menu, X } from "lucide-react";
import logo from "@/public/logo.png";
import { ScriptToggle } from "@/components/script-toggle";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string };

/**
 * Монгол бичгийн горимын цэс: том дэлгэцэнд зүүн талын босоо самбар, цэсийн нэр бүр босоо;
 * гар утсанд дээд мөр + ☰ товчоор нээгдэх, босоо нэрс нь зүүнээс баруун тийш эгнэсэн цэс.
 */
export function MglNav({ links, showAdmin, adminLabel }: { links: NavLink[]; showAdmin: boolean; adminLabel: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : !href.includes("#") && pathname.startsWith(href);

  const logoLink = (size: string) => (
    <Link href="/" aria-label="Нүүр хуудас" className="shrink-0">
      <Image src={logo} alt="Зэвсэгт хүчний 013 дугаар ангийн лого" sizes="48px" preload className={cn("w-auto", size)} />
    </Link>
  );

  return (
    <>
      {/* Том дэлгэц: зүүн талын босоо самбар */}
      <nav className="fixed inset-y-0 left-0 z-50 hidden w-24 flex-col items-center border-r border-border bg-background/95 backdrop-blur md:flex">
        <div className="flex flex-col items-center gap-1 py-5">
          {logoLink("h-12")}
          <span className="text-xs font-bold text-primary">013</span>
        </div>
        <ul className="flex flex-1 flex-col items-center gap-1 overflow-y-auto border-t border-border py-4">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={cn(
                  "mgl-v relative block rounded-md px-3 py-4 text-[1.05rem] leading-tight transition-colors hover:bg-primary/10 hover:text-primary",
                  isActive(link.href) ? "text-primary" : "text-foreground/80"
                )}
              >
                {isActive(link.href) && (
                  <span aria-hidden className="absolute inset-y-3 left-0 w-0.5 rounded bg-primary" />
                )}
                {link.label}
              </Link>
            </li>
          ))}
          {showAdmin && (
            <li className="mt-2 flex flex-col items-center gap-3">
              <Link
                href="/admin"
                className="mgl-v rounded-md bg-primary px-3 py-3 text-sm text-primary-foreground hover:bg-primary/90"
              >
                {adminLabel}
              </Link>
              <UserButton />
            </li>
          )}
        </ul>
        <div className="border-t border-border py-4">
          <ScriptToggle script="mgl" vertical />
        </div>
      </nav>

      {/* Гар утас: дээд мөр */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/90 backdrop-blur md:hidden">
        <div className="flex h-16 items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2">
            {logoLink("h-10")}
            <span className="text-sm font-bold text-primary">013</span>
          </div>
          <div className="flex items-center gap-2">
            <ScriptToggle script="mgl" />
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-label={open ? "Цэс хаах" : "Цэс нээх"}
              className="-mr-2 flex h-10 w-10 items-center justify-center rounded-md text-foreground hover:bg-muted"
            >
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
        {open && (
          <div className="border-t border-border bg-background shadow-xl shadow-black/50">
            <ul className="flex flex-row flex-wrap gap-2 px-4 py-4">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "mgl-v block rounded-md border px-3 py-4 text-lg leading-tight",
                      isActive(link.href)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-foreground hover:border-primary/60"
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              {showAdmin && (
                <li className="flex flex-col items-center gap-3">
                  <Link
                    href="/admin"
                    onClick={() => setOpen(false)}
                    className="mgl-v rounded-md bg-primary px-3 py-4 text-lg text-primary-foreground"
                  >
                    {adminLabel}
                  </Link>
                  <UserButton />
                </li>
              )}
            </ul>
          </div>
        )}
      </nav>
    </>
  );
}
