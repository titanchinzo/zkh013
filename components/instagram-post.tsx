"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import { canOptimizeImage, isUsableImageUrl } from "@/lib/images";

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

const SCRIPT_SRC = "https://www.instagram.com/embed.js";
const INSTAGRAM_ORIGIN = "https://www.instagram.com";
// Instagram-ийн өнгө (лого)
const BRAND_GRADIENT = "bg-linear-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5]";

let scriptLoader: Promise<void> | null = null;

/** embed.js-ийг нэг л удаа ачаална (нэвтрээгүй үед Instagram скриптийн оронд нэвтрэх хуудас буцааж болно) */
function loadEmbedScript(): Promise<void> {
  if (window.instgrm) return Promise.resolve();
  scriptLoader ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      scriptLoader = null;
      reject(new Error("Instagram embed.js ачаалагдсангүй"));
    };
    document.body.appendChild(script);
  });
  return scriptLoader;
}

type Props = {
  href: string;
  code: string | null;
  kind: "video" | "post";
  title: string;
  cover?: string; // мэдээний нүүр зураг (Instagram-аас зураг татах боломжгүй)
  label?: ReactNode; // MGL горимд монгол бичгээр
};

/**
 * Instagram пост/reel: эхлээд «Instagram дээр үзэх» карт харуулна (утсан дээр Instagram апп нээгдэнэ).
 * Ард нь албан ёсны embed-ийг оролдож, Instagram пост өөрийг нь өгвөл (embed өндрөө мэдээлбэл) картыг
 * embed-ээр солино. Instagram нэвтрээгүй хүнд ихэвчлэн нэвтрэх хуудас өгдөг тул карт хэвээр үлдэнэ.
 */
export function InstagramPost({ href, code, kind, title, cover, label }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const [embedded, setEmbedded] = useState(false);

  useEffect(() => {
    const el = holder.current;
    if (!el || !code) return; // задраагүй share/... холбоос embed хийгдэхгүй

    // embed.js blockquote-ийг iframe-ээр солидог тул React-ийн удирдлагаас гадуур үүсгэнэ
    const quote = document.createElement("blockquote");
    quote.className = "instagram-media";
    quote.setAttribute("data-instgrm-permalink", href);
    quote.setAttribute("data-instgrm-version", "14");
    quote.setAttribute("data-instgrm-captioned", "");
    quote.style.cssText = "margin:0;width:100%;max-width:540px;min-width:280px;border:0";
    el.replaceChildren(quote);

    // Жинхэнэ embed өндрөө (MEASURE) мэдээлдэг; нэвтрэх хуудас мэдээлдэггүй
    function onMessage(event: MessageEvent) {
      if (event.origin !== INSTAGRAM_ORIGIN || !el) return;
      const frame = el.querySelector("iframe");
      if (!frame || event.source !== frame.contentWindow) return;
      let data: unknown = event.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      const message = data as { type?: unknown; details?: { height?: unknown } } | null;
      const height = message?.details?.height;
      if (message?.type === "MEASURE" && typeof height === "number" && height > 100) setEmbedded(true);
    }

    window.addEventListener("message", onMessage);
    loadEmbedScript()
      .then(() => window.instgrm?.Embeds.process())
      .catch(() => {});
    return () => {
      window.removeEventListener("message", onMessage);
      el.replaceChildren();
    };
  }, [href, code]);

  const showCover = isUsableImageUrl(cover);

  return (
    <div className="relative">
      {!embedded && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${title} — Instagram дээр үзэх`}
          className="group relative z-10 flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-md border border-border p-4 text-white"
        >
          <span className={`absolute inset-0 overflow-hidden rounded-md ${BRAND_GRADIENT}`} aria-hidden="true">
            {showCover && (
              <>
                <Image
                  src={cover}
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 100vw, 800px"
                  unoptimized={!canOptimizeImage(cover)}
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
                <span className="absolute inset-0 bg-black/45" />
              </>
            )}
          </span>
          <span
            className={`relative flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg ring-2 ring-white/80 ${BRAND_GRADIENT}`}
            aria-hidden="true"
          >
            {kind === "video" ? <Play className="ml-1 h-7 w-7 fill-current" /> : <InstagramGlyph className="h-8 w-8" />}
          </span>
          <span className="relative inline-flex items-center gap-2 rounded-full bg-black/65 px-4 py-2 text-sm font-semibold shadow group-hover:bg-black/80">
            <InstagramGlyph className="h-4 w-4 shrink-0" />
            {label ?? "Instagram дээр үзэх"}
          </span>
        </a>
      )}
      <div
        ref={holder}
        aria-hidden={!embedded}
        // Батлагдах хүртэл үл харагдана; таслахгүй (lazy iframe ачаалагдахгүй болохоос сэргийлж)
        className={embedded ? "flex justify-center" : "pointer-events-none absolute inset-x-0 top-0 opacity-0"}
      />
    </div>
  );
}

function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}
