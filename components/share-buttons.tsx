"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

const subscribeNoop = () => () => {};

const BASE_BUTTON =
  "inline-flex items-center gap-2 rounded-md border border-border text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary";

export const SHARE_LABELS = {
  share: "Хуваалцах:",
  copy: "Холбоос хуулах",
  copied: "Хуулагдлаа",
  more: "Бусад",
};

/** Мэдээг Facebook-т хуваалцах, холбоос хуулах (гар утсанд системийн хуваалцах цэс) */
export function ShareButtons({
  title,
  labels = SHARE_LABELS,
  vertical = false,
}: {
  title: string;
  labels?: typeof SHARE_LABELS;
  // Монгол бичгийн горимд товчны бичиг босоо
  vertical?: boolean;
}) {
  const buttonClass = cn(BASE_BUTTON, vertical ? "mgl-v px-2 py-3" : "h-9 px-3");
  const [copied, setCopied] = useState(false);
  // navigator.share зөвхөн browser-т байдаг тул server дээр false гэж үзнэ
  const canNativeShare = useSyncExternalStore(
    subscribeNoop,
    () => typeof navigator.share === "function",
    () => false
  );

  function shareOnFacebook() {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`;
    window.open(url, "_blank", "noopener,noreferrer,width=640,height=560");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Холбоосыг хуулна уу:", window.location.href);
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, url: window.location.href });
    } catch {
      // хэрэглэгч цуцалсан
    }
  }

  return (
    <div className={cn("flex items-center gap-2", vertical ? "flex-row items-start" : "flex-wrap")}>
      <span className={cn("text-sm text-muted-foreground", vertical ? "mgl-v" : "mr-1")}>{labels.share}</span>
      <button type="button" onClick={shareOnFacebook} className={buttonClass}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07" />
        </svg>
        Facebook
      </button>
      <button type="button" onClick={copyLink} className={buttonClass}>
        {copied ? <Check className="h-4 w-4 text-primary" /> : <Link2 className="h-4 w-4" />}
        {copied ? labels.copied : labels.copy}
      </button>
      {canNativeShare && (
        <button type="button" onClick={nativeShare} className={buttonClass}>
          <Share2 className="h-4 w-4" />
          {labels.more}
        </button>
      )}
    </div>
  );
}
