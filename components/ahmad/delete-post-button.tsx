"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

/** Өөрийн постыг (эсвэл хянагч ямар ч постыг) устгана */
export function DeletePostButton({ postId, label = "Устгах" }: { postId: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm("Энэ постыг зурагтай нь устгах уу?")) return;
    setBusy(true);
    const res = await fetch(`/api/ahmad/${postId}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      alert((await res?.json().catch(() => null))?.error ?? "Устгаж чадсангүй");
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-red-400 disabled:opacity-50"
    >
      <Trash2 className="size-3.5" aria-hidden />
      {label}
    </button>
  );
}
