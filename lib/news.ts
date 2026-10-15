import "server-only";
import { cache } from "react";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import News from "@/lib/models/News";
import { isUsableImageUrl } from "@/lib/images";
import { parseMediaUrl, youTubeThumbnail, type NewsMedia } from "@/lib/media";

// Нийтийн мэдээний хуудсуудад ашиглах өгөгдөл татах туслах функцууд

type NewsDoc = {
  _id: unknown;
  title: string;
  excerpt: string;
  content: string;
  imageUrl?: string;
  mediaUrl?: string;
  images?: string[];
  status: string;
  createdAt: Date;
};

export type NewsSummary = {
  id: string;
  title: string;
  excerpt: string;
  cover: string | null; // жагсаалтад харагдах зураг
  media: NewsMedia | null;
  photoCount: number; // зургийн цомгийн тоо
  createdAt: Date;
};

export type NewsArticle = NewsSummary & {
  content: string;
  imageUrl: string;
  images: string[];
};

const SUMMARY_FIELDS = "title excerpt imageUrl mediaUrl images createdAt";
const PUBLISHED = { status: "published" };

/** Оруулсан нүүр зураг, эсвэл YouTube видеоны зураг */
function coverOf(doc: Pick<NewsDoc, "imageUrl">, media: NewsMedia | null) {
  if (isUsableImageUrl(doc.imageUrl)) return doc.imageUrl;
  return media?.provider === "youtube" ? youTubeThumbnail(media.videoId) : null;
}

function toSummary(doc: NewsDoc): NewsSummary {
  const media = parseMediaUrl(doc.mediaUrl);
  return {
    id: String(doc._id),
    title: doc.title,
    excerpt: doc.excerpt,
    cover: coverOf(doc, media),
    media,
    photoCount: doc.images?.length ?? 0,
    createdAt: new Date(doc.createdAt),
  };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Нийтлэгдсэн мэдээг хайлт, хуудаслалттайгаар татна */
export async function getPublishedNews({ q, page, perPage }: { q: string; page: number; perPage: number }) {
  await connectToDatabase();
  const search = q ? new RegExp(escapeRegex(q.slice(0, 100)), "i") : null;
  const filter = search
    ? { ...PUBLISHED, $or: [{ title: search }, { excerpt: search }, { content: search }] }
    : PUBLISHED;

  const [docs, total] = await Promise.all([
    News.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .select(SUMMARY_FIELDS)
      .lean(),
    News.countDocuments(filter),
  ]);

  return {
    items: (docs as unknown as NewsDoc[]).map(toSummary),
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

/** Хамгийн сүүлийн нийтлэгдсэн мэдээнүүд (excludeId-гүйгээр) */
export async function getLatestNews(limit: number, excludeId?: string) {
  await connectToDatabase();
  const filter = excludeId ? { ...PUBLISHED, _id: { $ne: excludeId } } : PUBLISHED;
  const docs = await News.find(filter).sort({ createdAt: -1 }).limit(limit).select(SUMMARY_FIELDS).lean();
  return (docs as unknown as NewsDoc[]).map(toSummary);
}

/** Нэг нийтлэгдсэн мэдээ (generateMetadata болон хуудас хоёулаа нэг хүсэлтээр ашиглана) */
export const getPublishedArticle = cache(async (id: string): Promise<NewsArticle | null> => {
  if (!isValidObjectId(id)) return null;
  await connectToDatabase();
  const doc = (await News.findOne({ ...PUBLISHED, _id: id }).lean()) as unknown as NewsDoc | null;
  if (!doc) return null;
  return {
    ...toSummary(doc),
    content: doc.content,
    imageUrl: isUsableImageUrl(doc.imageUrl) ? doc.imageUrl : "",
    images: (doc.images ?? []).filter((url) => isUsableImageUrl(url)),
  };
});

/** Өмнөх (хуучин) болон дараагийн (шинэ) мэдээ */
export async function getAdjacentNews(createdAt: Date) {
  await connectToDatabase();
  const [older, newer] = await Promise.all([
    News.findOne({ ...PUBLISHED, createdAt: { $lt: createdAt } }).sort({ createdAt: -1 }).select(SUMMARY_FIELDS).lean(),
    News.findOne({ ...PUBLISHED, createdAt: { $gt: createdAt } }).sort({ createdAt: 1 }).select(SUMMARY_FIELDS).lean(),
  ]);
  return {
    older: older ? toSummary(older as unknown as NewsDoc) : null,
    newer: newer ? toSummary(newer as unknown as NewsDoc) : null,
  };
}

// Vercel сервер UTC цагаар ажилладаг тул огноог Улаанбаатарын цагаар харуулна
const TIME_ZONE = "Asia/Ulaanbaatar";
const shortDate = new Intl.DateTimeFormat("mn-MN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: TIME_ZONE,
});
const longDate = new Intl.DateTimeFormat("mn-MN", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: TIME_ZONE,
});

/** 2026.10.15 */
export function formatShortDate(date: Date) {
  return shortDate.format(date);
}

/** 2026 оны аравдугаар сарын 15 */
export function formatLongDate(date: Date) {
  return longDate.format(date);
}

/** Унших хугацаа (минутаар, ~200 үг/минут) */
export function readingMinutes(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
