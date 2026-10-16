"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { SCRIPT_COOKIE, type Script } from "@/lib/mgl/shared";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Script; label: string; title: string }[] = [
  { value: "mn", label: "MN", title: "Кирилл бичиг" },
  { value: "mgl", label: "MGL", title: "Монгол бичиг" },
];

function saveScript(value: Script) {
  document.cookie = `${SCRIPT_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
}

/** MN (кирилл) ба MGL (монгол бичиг) горимыг солих товч */
export function ScriptToggle({ script, vertical }: { script: Script; vertical?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(value: Script) {
    if (value === script) return;
    saveScript(value);
    startTransition(() => router.refresh());
  }

  return (
    <div
      role="group"
      aria-label="Бичгийн горим"
      className={cn(
        "inline-flex shrink-0 overflow-hidden rounded-md border border-primary/50 text-xs font-bold",
        vertical ? "flex-col" : "flex-row",
        pending && "opacity-60"
      )}
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.title}
          aria-pressed={option.value === script}
          onClick={() => choose(option.value)}
          className={cn(
            "px-2.5 py-1.5 transition-colors",
            option.value === script
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-primary/15 hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
