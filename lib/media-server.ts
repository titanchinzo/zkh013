import "server-only";
import { isFacebookCdnUrl } from "@/lib/images";
import {
  isFacebookShortLink,
  isFacebookUrl,
  parseMediaUrl,
  youTubeThumbnail,
  type NewsMedia,
} from "@/lib/media";

// Facebook нэвтрээгүй энгийн browser-т нэвтрэх хуудас буцаадаг тул crawler-ээр танилцуулна
const CRAWLER_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const FETCH_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 5;

/**
 * Хэрэглэгчийн оруулсан холбоосыг хадгалахад бэлэн болгоно.
 * Хоосон бол "", YouTube/Facebook биш бол null буцаана.
 */
export async function prepareMediaUrl(raw: unknown): Promise<string | null> {
  if (raw == null || raw === "") return "";
  if (typeof raw !== "string") return null;
  const media = parseMediaUrl(raw);
  if (!media) return null;
  return (await resolveMedia(media)).href;
}

/** fb.watch, facebook.com/share/... богино холбоосыг бүтэн хаяг руу нь хөрвүүлнэ (чадахгүй бол хэвээр нь) */
export async function resolveMedia(media: NewsMedia): Promise<NewsMedia> {
  if (media.provider !== "facebook" || !isFacebookShortLink(media.href)) return media;

  try {
    let current = media.href;
    for (let i = 0; i < MAX_REDIRECTS; i++) {
      const res = await fetch(current, {
        redirect: "manual",
        headers: { "User-Agent": CRAWLER_UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const location = res.headers.get("location");

      if (res.status >= 300 && res.status < 400 && location) {
        const next = new URL(location, current);
        // Нэвтрэх хуудас руу шилжүүлбэл жинхэнэ хаяг нь ?next= дотор байдаг
        const target = next.pathname.startsWith("/login") ? next.searchParams.get("next") : next.toString();
        if (!target || !isFacebookUrl(target)) break;
        current = target;
        const parsed = parseMediaUrl(current);
        if (parsed && !isFacebookShortLink(parsed.href)) return parsed;
        continue;
      }

      if (res.ok) {
        const html = await res.text();
        const ogUrl = html.match(/<meta property="og:url" content="([^"]+)"/)?.[1];
        const parsed = ogUrl ? parseMediaUrl(decodeHtml(ogUrl)) : null;
        if (parsed && !isFacebookShortLink(parsed.href)) return parsed;
      }
      break;
    }
  } catch (err) {
    console.warn("[media] Facebook холбоосыг задалж чадсангүй:", err);
  }
  return media;
}

// Facebook нь Twitterbot-д зураг, видео, reel, постын og:image-ийг өгдөг (facebookexternalhit-д өгдөггүй)
const PREVIEW_UA = "Mozilla/5.0 (compatible; Twitterbot/1.0)";

/**
 * Facebook видео, reel, зураг, постын нүүр зургийн хаяг (fbcdn). Хаяг нь хэд хоногийн дараа
 * хүчингүй болдог тул хадгалахдаа lib/image-import.ts-ээр Blob руу хуулна.
 */
export async function facebookPreviewImage(href: string): Promise<string | null> {
  try {
    const res = await fetch(href, {
      headers: { "User-Agent": PREVIEW_UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const raw = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
    const image = raw ? decodeHtml(raw) : null;
    return image && isFacebookCdnUrl(image) ? image : null;
  } catch (err) {
    console.warn("[media] Facebook-ийн зургийг олж чадсангүй:", err);
    return null;
  }
}

/** YouTube видеоны хамгийн том thumbnail (maxresdefault бүх видеонд байдаггүй) */
export async function bestYouTubeThumbnail(videoId: string) {
  const maxres = youTubeThumbnail(videoId, "maxresdefault");
  try {
    const res = await fetch(maxres, { method: "HEAD", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (res.ok) return maxres;
  } catch {
    // hqdefault руу буцна
  }
  return youTubeThumbnail(videoId, "hqdefault");
}

function decodeHtml(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&#x2f;/gi, "/").replace(/&quot;/g, '"');
}
