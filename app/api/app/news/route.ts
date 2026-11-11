import { NextRequest, NextResponse } from "next/server";
import { getApprovedDevice } from "@/lib/device";
import { userRole } from "@/lib/actor";
import News from "@/lib/models/News";
import { SUMMARY_FIELDS, toSummary, type NewsDoc } from "@/lib/news";
import { canReview, isNewsRole } from "@/lib/roles";

const PAGE = 20;

type StaffDoc = NewsDoc & { authorName?: string };

const summary = (doc: StaffDoc, staff = false) => {
  const s = toSummary(doc);
  return {
    id: s.id,
    title: s.title,
    excerpt: s.excerpt,
    cover: s.cover,
    photoCount: s.photoCount,
    videoCount: s.videoCount,
    hasMedia: Boolean(s.media),
    createdAt: s.createdAt,
    ...(staff ? { status: doc.status, authorName: doc.authorName ?? "" } : {}),
  };
};

/**
 * Утсан дээрх аппын «Мэдээ»: нийтлэгдсэн мэдээ (?before=<огноо> — цааш нь), хянагчид хяналт хүлээж буй мэдээ,
 * мэдээ бичих эрхтэй хүнд өөрийн мэдээ (төлөвтэй нь). Мэдээ бичих, хянахыг сайтын /api/news-ээр хийнэ.
 */
export async function GET(req: NextRequest) {
  const device = await getApprovedDevice();
  if (!device) return NextResponse.json({ error: "Энэ утсыг хүний нөөц зөвшөөрөөгүй байна" }, { status: 403 });
  const { role } = await userRole(device.userId);
  const before = new Date(req.nextUrl.searchParams.get("before") ?? "");
  const older = Number.isNaN(before.getTime()) ? {} : { createdAt: { $lt: before } };
  const first = !("createdAt" in older);
  const reviewer = canReview(role);
  const writer = isNewsRole(role);
  const staffFields = `${SUMMARY_FIELDS} status authorName`;

  const [published, pending, mine] = await Promise.all([
    News.find({ status: "published", ...older })
      .sort({ createdAt: -1 })
      .limit(PAGE + 1)
      .select(SUMMARY_FIELDS)
      .lean<StaffDoc[]>(),
    first && reviewer
      ? News.find({ status: "pending" }).sort({ createdAt: 1 }).select(staffFields).lean<StaffDoc[]>()
      : [],
    first && writer
      ? News.find({ authorId: device.userId }).sort({ createdAt: -1 }).limit(20).select(staffFields).lean<StaffDoc[]>()
      : [],
  ]);

  return NextResponse.json({
    role,
    canWrite: writer,
    canReview: reviewer,
    published: published.slice(0, PAGE).map((d) => summary(d)),
    more: published.length > PAGE,
    pending: pending.map((d) => summary(d, true)),
    mine: mine.map((d) => summary(d, true)),
  });
}
