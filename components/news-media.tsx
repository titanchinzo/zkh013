import { FacebookPost } from "@/components/facebook-post";
import type { NewsMedia } from "@/lib/media";

const IFRAME_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

/** Мэдээнд хавсаргасан YouTube/Facebook видео эсвэл Facebook постыг харуулна */
export function NewsMediaEmbed({ media, title }: { media: NewsMedia; title: string }) {
  if (media.provider === "facebook" && media.kind === "post") {
    return <FacebookPost href={media.href} />;
  }

  return (
    <div
      className={`relative w-full overflow-hidden rounded-md border border-border bg-black ${
        // Shorts / Reel босоо видео
        media.portrait ? "mx-auto max-w-sm aspect-[9/16]" : "aspect-video"
      }`}
    >
      <iframe
        src={media.embedSrc}
        title={title}
        allow={IFRAME_ALLOW}
        allowFullScreen
        loading="lazy"
        // YouTube embed нь referrer-гүй үед тоглохгүй (Error 153)
        referrerPolicy="strict-origin-when-cross-origin"
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}
