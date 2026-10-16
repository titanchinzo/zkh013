import { cn } from "@/lib/utils";
import { UlziiKnot } from "@/components/mgl/mgl-ornaments";

/**
 * Монгол бичгийн горимын хэсгийн гарчиг: оройд өлзий хээ, босоо гарчиг, баруун талдаа алтлаг давхар зураас
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
      {eyebrow && <span className="mgl-v pt-10 text-sm leading-relaxed text-primary">{eyebrow}</span>}
      <div className="flex flex-col items-center gap-3">
        <UlziiKnot className="h-7 w-7 text-gold" />
        <Tag className="mgl-v text-3xl leading-snug text-foreground md:text-4xl">{title}</Tag>
      </div>
      <span aria-hidden className="mt-10 flex h-24 shrink-0 flex-col items-center">
        <span className="w-[5px] flex-1 border-x border-gold/70" />
        <span className="-mt-1 h-2 w-2 rotate-45 bg-gold" />
      </span>
    </div>
  );
}
