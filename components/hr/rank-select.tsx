import { RANKS } from "@/lib/hr";
import { cn } from "@/lib/utils";

/**
 * Цол сонгох (name="rank"). Жагсаалт гарахаас өмнө гараар бичсэн хуучин цол байвал түүнийг ч сонголтод
 * үлдээнэ — засахад алга болохгүй.
 */
export function RankSelect({ defaultValue = "", className }: { defaultValue?: string; className?: string }) {
  const legacy = defaultValue && !(RANKS as readonly string[]).includes(defaultValue) ? defaultValue : null;
  return (
    <select
      name="rank"
      defaultValue={defaultValue}
      aria-label="Цол"
      className={cn(
        "h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        className
      )}
    >
      <option value="">Цол сонгох</option>
      {legacy && <option value={legacy}>{legacy}</option>}
      {RANKS.map((rank) => (
        <option key={rank} value={rank}>
          {rank}
        </option>
      ))}
    </select>
  );
}
