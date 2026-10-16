import { cn } from "@/lib/utils";

/**
 * Монгол бичгийн горимын хэсгийн гарчиг: босоо гарчиг, баруун талдаа ногоон зураас
 * (MN горимын гарчгийн доорх зураасны босоо хувилбар).
 */
export function MglHeading({
  title,
  eyebrow,
  as: Tag = "h2",
  className,
}: {
  title: string;
  eyebrow?: string;
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cn("flex shrink-0 flex-row items-start gap-3", className)}>
      {eyebrow && <span className="mgl-v text-sm leading-relaxed text-primary">{eyebrow}</span>}
      <Tag className="mgl-v text-3xl leading-snug text-foreground md:text-4xl">{title}</Tag>
      <span aria-hidden className="h-20 w-1 shrink-0 bg-primary" />
    </div>
  );
}
