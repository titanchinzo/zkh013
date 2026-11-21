import type { ReactNode } from "react";
import { FacebookPost } from "@/components/facebook-post";
import { InstagramPost } from "@/components/instagram-post";
import type { NewsMedia } from "@/lib/media";

const IFRAME_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

type Props = {
  media: NewsMedia;
  title: string;
  cover?: string; // Instagram картын зураг (мэдээний нүүр зураг)
  openLabel?: ReactNode; // «Instagram дээр үзэх» (MGL горимд монгол бичгээр)
};

/** Мэдээнд хавсаргасан YouTube/Facebook видео, Facebook пост эсвэл Instagram пост/reel-ийг харуулна */
export function NewsMediaEmbed({ media, title, cover, openLabel }: Props) {
  if (media.provider === "instagram") {
    return (
      <InstagramPost
        key={media.href}
        href={media.href}
        code={media.code}
        kind={media.kind}
        title={title}
        cover={cover}
        label={openLabel}
      />
    );
  }
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
