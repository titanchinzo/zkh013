import Image from "next/image";
import logo from "@/public/logo.png";
import { cn } from "@/lib/utils";

/** Ангийн лого + "ЗЭВСЭГТ ХҮЧНИЙ 013" (цэс, footer-т) */
export function Brand({ className, preload }: { className?: string; preload?: boolean }) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <Image
        src={logo}
        alt="Зэвсэгт хүчний 013 дугаар ангийн лого"
        preload={preload}
        sizes="40px"
        className="h-10 w-auto shrink-0"
      />
      <span className="text-sm font-bold tracking-wider sm:tracking-widest text-foreground whitespace-nowrap">
        ЗЭВСЭГТ ХҮЧНИЙ <span className="text-primary">013</span>
      </span>
    </span>
  );
}
