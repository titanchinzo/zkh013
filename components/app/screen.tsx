"use client";

import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";

/** Утсан дээрх аппын бүтэн дэлгэцийн цонх — буцах товчтой толгой, гүйдэг бие (мэдээ, хүний нөөцийн хэрэгсэл) */
export function Screen({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  useEffect(() => {
    // Арын хуудас гүйхгүй
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-label={title}>
      <header className="shrink-0 border-b border-border bg-background" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex max-w-md items-center gap-2 px-2 py-2">
          <button
            onClick={onBack}
            aria-label="Буцах"
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-foreground active:bg-muted"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          <p className="truncate font-semibold text-foreground">{title}</p>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto overscroll-contain" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto max-w-md space-y-4 px-4 py-4">{children}</div>
      </div>
    </div>
  );
}
