// Мэдээнд хавсаргах YouTube / Facebook / Instagram холбоосыг задлах туслах функцууд
// (server болон client аль алинд ажиллана)

import { isFacebookCdnUrl } from "@/lib/images";

export type NewsMedia =
  | {
      provider: "youtube";
      kind: "video";
      href: string; // хадгалах цэвэрлэсэн холбоос
      embedSrc: string;
      portrait: boolean; // Shorts бол босоо
      videoId: string;
    }
  | {
      provider: "facebook";
      kind: "video" | "post";
      href: string;
      embedSrc: string; // зөвхөн видеонд ашиглагдана, пост нь SDK-аар гарна
      // Reel хэвтээ ч, босоо ч байж болох тул Facebook видеог үргэлж 16:9 хүрээнд харуулна
      portrait: false;
    }
  | {
      // Instagram нэвтрээгүй хүнд embed-ээ ихэвчлэн өгдөггүй тул «Instagram дээр үзэх» карт гарна,
      // embed ачаалагдвал (Instagram зөвшөөрвөл) пост өөрөө харагдана
      provider: "instagram";
      kind: "video" | "post"; // reel / пост
      href: string;
      code: string | null; // постын код; задраагүй share/... богино холбоос бол null
    };

export const MEDIA_URL_ERROR = "Зөвхөн YouTube, Facebook эсвэл Instagram-ийн видео/постын холбоос оруулна уу";

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
]);
const FACEBOOK_HOSTS = new Set([
  "facebook.com",
  "m.facebook.com",
  "web.facebook.com",
  "mbasic.facebook.com",
  "touch.facebook.com",
  "fb.com",
  "fb.watch",
]);
const INSTAGRAM_HOSTS = new Set(["instagram.com", "m.instagram.com", "instagr.am"]);

// Facebook холбоосын замд хамааралтай query параметрүүд (бусад нь tracking тул хаяна)
const FACEBOOK_KEEP_PARAMS = ["v", "story_fbid", "id", "fbid", "set"];

export function parseMediaUrl(raw: string | null | undefined): NewsMedia | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (YOUTUBE_HOSTS.has(host)) return parseYouTube(url, host);
  if (FACEBOOK_HOSTS.has(host)) return parseFacebook(url, host);
  if (INSTAGRAM_HOSTS.has(host)) return parseInstagram(url);
  return null;
}

/** YouTube-ийн thumbnail (бүх видеонд байдаг хэмжээ) */
export function youTubeThumbnail(videoId: string, size: "hqdefault" | "maxresdefault" = "hqdefault") {
  return `https://i.ytimg.com/vi/${videoId}/${size}.jpg`;
}

/** Холбоосоос автоматаар бөглөгдсөн зураг эсэх (YouTube thumbnail эсвэл хадгалаагүй Facebook зураг) */
function isAutoThumbnail(url: string) {
  return url.startsWith("https://i.ytimg.com/vi/") || isFacebookCdnUrl(url);
}

/**
 * Видеоны холбоос өөрчлөгдөхөд мэдээний зургийг шинэчилнэ: хэрэглэгчийн өөрөө оруулсан
 * зургийг дарахгүй, зөвхөн хоосон эсвэл өмнө нь автоматаар бөглөгдсөн бол солино.
 */
export function autoFillImage(current: string, thumbnailUrl: string | null) {
  return !current || isAutoThumbnail(current) ? (thumbnailUrl ?? "") : current;
}

/** fb.watch болон share/... хэлбэрийн богино холбоосыг server дээр бүтэн хаяг руу нь хөрвүүлэх шаардлагатай */
export function isFacebookShortLink(href: string) {
  const { hostname, pathname } = new URL(href);
  return hostname === "fb.watch" || pathname.startsWith("/share/");
}

export function isFacebookUrl(href: string) {
  try {
    return FACEBOOK_HOSTS.has(new URL(href).hostname.toLowerCase().replace(/^www\./, ""));
  } catch {
    return false;
  }
}

function parseYouTube(url: URL, host: string): NewsMedia | null {
  const segments = url.pathname.split("/").filter(Boolean);
  let videoId: string | null = null;
  let portrait = false;

  if (host === "youtu.be") {
    videoId = segments[0] ?? null;
  } else if (segments[0] === "watch") {
    videoId = url.searchParams.get("v");
  } else if (["shorts", "embed", "live", "v"].includes(segments[0])) {
    videoId = segments[1] ?? null;
    portrait = segments[0] === "shorts";
  }
  if (!videoId || !/^[\w-]{11}$/.test(videoId)) return null;

  const start = parseYouTubeTime(url.searchParams.get("t") ?? url.searchParams.get("start"));
  const href = portrait
    ? `https://www.youtube.com/shorts/${videoId}`
    : `https://www.youtube.com/watch?v=${videoId}${start ? `&t=${start}s` : ""}`;

  return {
    provider: "youtube",
    kind: "video",
    href,
    embedSrc: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0${start ? `&start=${start}` : ""}`,
    portrait,
    videoId,
  };
}

/** "90", "90s", "1m30s", "1h2m3s" → секунд */
function parseYouTubeTime(value: string | null) {
  if (!value) return 0;
  if (/^\d+s?$/.test(value)) return parseInt(value, 10);
  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match) return 0;
  const [, h = "0", m = "0", s = "0"] = match;
  return parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10);
}

function parseFacebook(url: URL, host: string): NewsMedia | null {
  const path = url.pathname.replace(/\/+$/, "") || "/";

  let kind: "video" | "post";
  if (host === "fb.watch") {
    if (path === "/") return null;
    kind = "video";
  } else if (/\/(videos|reel|watch)(\/|$)/.test(path) || /^\/share\/[vr]\//.test(path)) {
    kind = "video";
    if (path === "/watch" && !url.searchParams.get("v")) return null;
  } else if (
    /\/(posts|permalink|photos)\//.test(path) ||
    /^\/(permalink|story|photo)\.php$/.test(path) ||
    path === "/photo" ||
    /^\/share\/(p\/)?[\w-]+$/.test(path)
  ) {
    kind = "post";
  } else {
    // Хуудасны нүүр гэх мэт embed хийх боломжгүй холбоос
    return null;
  }

  const kept = new URLSearchParams();
  for (const key of FACEBOOK_KEEP_PARAMS) {
    const value = url.searchParams.get(key);
    if (value) kept.set(key, value);
  }
  const query = kept.toString();
  const base = host === "fb.watch" ? "https://fb.watch" : "https://www.facebook.com";
  const href = `${base}${path}${path.endsWith(".php") || path === "/watch" || path === "/photo" ? "" : "/"}${query ? `?${query}` : ""}`;

  return {
    provider: "facebook",
    kind,
    href,
    embedSrc: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(href)}&show_text=false`,
    portrait: false,
  };
}

// Instagram-ийн постын замын төрлүүд (reels/tv хуучин хэлбэрийг reel/tv болгоно)
const INSTAGRAM_TYPES = new Map([
  ["p", "p"],
  ["reel", "reel"],
  ["reels", "reel"],
  ["tv", "tv"],
]);

function parseInstagram(url: URL): NewsMedia | null {
  const segments = url.pathname.split("/").filter(Boolean);

  // Аппын «Хуваалцах» богино холбоос: /share/<token>, /share/p/<token>, /share/reel/<token>
  if (segments[0] === "share") {
    const rest = segments.slice(1);
    const token = rest[rest.length - 1];
    if (rest.length < 1 || rest.length > 2 || !/^[\w-]+$/.test(token)) return null;
    if (rest.length === 2 && !INSTAGRAM_TYPES.has(rest[0])) return null;
    return {
      provider: "instagram",
      kind: rest.length === 2 && rest[0] !== "p" ? "video" : "post",
      href: `https://www.instagram.com/share/${rest.join("/")}/`,
      code: null,
    };
  }

  // /p/<код>, /reel/<код>, /reels/<код>, /tv/<код>, мөн шинэ хэлбэрийн /<хэрэглэгч>/p/<код>
  // (?igsh=, ?utm_source= зэрэг tracking параметрийг хаяна)
  const at = segments.findIndex((segment) => INSTAGRAM_TYPES.has(segment));
  if (at < 0 || at > 1 || (at === 1 && !/^[\w.]+$/.test(segments[0]))) return null;
  const type = INSTAGRAM_TYPES.get(segments[at]);
  const code = segments[at + 1];
  if (!type || !code || !/^[\w-]{5,64}$/.test(code)) return null;

  return {
    provider: "instagram",
    kind: type === "p" ? "post" : "video",
    href: `https://www.instagram.com/${type}/${code}/`,
    code,
  };
}
