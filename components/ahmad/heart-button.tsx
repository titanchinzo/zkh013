"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { mglDigits } from "@/lib/mgl/shared";
import { cn } from "@/lib/utils";

/**
 * «Ахмад» постын зүрх — нэвтэрсэн хүн дарна (дахин дарвал болино). Нэвтрээгүй бол нэвтрэх хуудас руу.
 * vertical — монгол бичгийн горимд тоо монгол цифрээр.
 */
export function HeartButton({
  postId,
  count,
  hearted,
  signedIn,
  vertical,
}: {
  postId: string;
  count: number;
  hearted: boolean;
  signedIn: boolean;
  vertical?: boolean;
}) {
  const [state, setState] = useState({ count, hearted });
  const [busy, setBusy] = useState(false);
  const shown = vertical ? mglDigits(String(state.count)) : String(state.count);
  const className = cn(
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
    vertical && "flex-col px-1.5 py-3",
    state.hearted ? "border-red-400/50 bg-red-500/10 text-red-400" : "border-border text-muted-foreground hover:text-red-400"
  );

  if (!signedIn) {
    return (
      <Link href="/sign-in?redirect_url=/ahmad" className={className} aria-label={`Зүрх (${state.count}) — нэвтэрч дарна`}>
        <Heart className="size-4" aria-hidden />
        <span>{shown}</span>
      </Link>
    );
  }

  async function toggle() {
    if (busy) return;
    const next = !state.hearted;
    setBusy(true);
    // Шууд харуулж, сервер зөвшөөрөөгүй бол буцаана
    setState((s) => ({ count: s.count + (next ? 1 : -1), hearted: next }));
    const res = await fetch(`/api/ahmad/${postId}/heart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hearted: next }),
    }).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setState({ count: data.hearts, hearted: data.hearted });
    } else {
      setState((s) => ({ count: s.count + (next ? -1 : 1), hearted: !next }));
    }
    setBusy(false);
  }

  return (
    <button type="button" onClick={toggle} disabled={busy} className={className} aria-pressed={state.hearted} aria-label={`Зүрх (${state.count})`}>
      <Heart className={cn("size-4", state.hearted && "fill-current")} aria-hidden />
      <span>{shown}</span>
    </button>
  );
}
