import "server-only";
import { currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import AhmadPost from "@/lib/models/AhmadPost";
import Personnel from "@/lib/models/Personnel";
import { canReview, resolveRole } from "@/lib/roles";
import { personnelLabel } from "@/lib/hr";
import { isStoredFileUrl } from "@/lib/images";
import { AHMAD_PER_PAGE, hasAhmadFlag, type AhmadPostView } from "@/lib/ahmad";

export type AhmadViewer = {
  userId: string;
  // Нийтэд харагдах нэр: хүний нөөцийн бүртгэлтэй бол цол, нэр; үгүй бол сайтад бүртгүүлсэн нэр
  name: string;
  canPost: boolean; // «Ахмад» эрхтэй эсвэл админ
  canReview: boolean; // хянагч, админ
};

/** Сайтад нэвтэрсэн хүн (нэвтрээгүй бол null) */
export async function ahmadViewer(): Promise<AhmadViewer | null> {
  const user = await currentUser();
  if (!user) return null;
  const role = resolveRole(user.publicMetadata as { role?: string }, user.primaryEmailAddress?.emailAddress);
  await connectToDatabase();
  const person = await Personnel.findOne({ userId: user.id }).select("rank name").lean<{ rank: string; name: string }>();
  // И-мэйлийг нийтэд хэзээ ч гаргахгүй
  const name = person ? personnelLabel(person) : user.fullName?.trim() || "Ахмад";
  return { userId: user.id, name, canPost: hasAhmadFlag(user.publicMetadata) || role === "admin", canReview: canReview(role) };
}

/** Зөвхөн энэ хэсэгт оруулсан зураг (/uploads/ahmad/… эсвэл Vercel Blob-ийн ahmad/…) */
export function isAhmadImageUrl(url: unknown): url is string {
  if (typeof url !== "string" || !isStoredFileUrl(url)) return false;
  if (url.startsWith("/")) return url.startsWith("/uploads/ahmad/");
  try {
    return new URL(url).pathname.startsWith("/ahmad/");
  } catch {
    return false;
  }
}

export type PostDoc = {
  _id: unknown;
  author: string;
  authorName: string;
  text: string;
  year?: number | null;
  images: string[];
  status: "pending" | "published" | "rejected";
  createdAt: Date;
  publishedAt?: Date | null;
  hearts?: string[];
};

export function toView(doc: PostDoc, viewerId?: string | null): AhmadPostView {
  const hearts = doc.hearts ?? [];
  return {
    id: String(doc._id),
    authorName: doc.authorName,
    text: doc.text,
    year: doc.year ?? null,
    images: doc.images ?? [],
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    publishedAt: doc.publishedAt ? doc.publishedAt.toISOString() : null,
    hearts: hearts.length,
    hearted: Boolean(viewerId && hearts.includes(viewerId)),
    mine: Boolean(viewerId && doc.author === viewerId),
  };
}

/** Нийтлэгдсэн постууд — шинэ нь эхэндээ */
export async function publishedPosts(page: number, viewerId?: string | null) {
  await connectToDatabase();
  const filter = { status: "published" };
  const [docs, total] = await Promise.all([
    AhmadPost.find(filter)
      .sort({ publishedAt: -1, _id: -1 })
      .skip((page - 1) * AHMAD_PER_PAGE)
      .limit(AHMAD_PER_PAGE)
      .lean<PostDoc[]>(),
    AhmadPost.countDocuments(filter),
  ]);
  return { posts: docs.map((d) => toView(d, viewerId)), total, totalPages: Math.max(1, Math.ceil(total / AHMAD_PER_PAGE)) };
}

/** Миний хянагдаж буй, буцаагдсан постууд (зөвхөн надад харагдана) */
export async function myUnpublishedPosts(userId: string) {
  await connectToDatabase();
  const docs = await AhmadPost.find({ author: userId, status: { $in: ["pending", "rejected"] } })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean<PostDoc[]>();
  return docs.map((d) => toView(d, userId));
}
