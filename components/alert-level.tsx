import { ALERT_LEVEL_LABEL, type AlertLevel } from "@/lib/hr";

const BADGE: Record<AlertLevel, string> = {
  red: "border-red-500 bg-red-600 text-white",
  yellow: "border-yellow-400/60 bg-yellow-400/15 text-yellow-300",
  green: "border-green-500/60 bg-green-500/15 text-green-400",
};

/** Зарлан мэдээллийн картын зүүн захын зураас */
export const ALERT_LEVEL_EDGE: Record<AlertLevel, string> = {
  red: "border-l-4 border-l-red-600",
  yellow: "border-l-4 border-l-yellow-400",
  green: "border-l-4 border-l-green-500",
};

/** Зарлан мэдээллийн түвшин: Улаан / Шар / Ногоон */
export function AlertLevelBadge({ level }: { level: AlertLevel }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-bold leading-none ${BADGE[level]}`}>
      {ALERT_LEVEL_LABEL[level]}
    </span>
  );
}
