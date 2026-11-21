import { NextRequest, NextResponse, after } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import AhmadPost from "@/lib/models/AhmadPost";
import { AHMAD_LIMITS, AHMAD_YEAR_MIN } from "@/lib/ahmad";
import { ahmadViewer, isAhmadImageUrl, toView, type PostDoc } from "@/lib/ahmad-server";
import { newsReviewerIds } from "@/lib/actor";
import { pushToDevices } from "@/lib/push";
import { todayUb } from "@/lib/hr";

// «Ахмад»: GET — хянагчид (хянагдаж буй + сүүлд нийтлэгдсэн), POST — «Ахмад» эрхтэй хүн пост илгээнэ (хянагдана).

export async function GET() {
  const viewer = await ahmadViewer();
  if (!viewer?.canReview) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  await connectToDatabase();
  const [pending, published] = await Promise.all([
    AhmadPost.find({ status: "pending" }).sort({ createdAt: 1 }).lean<PostDoc[]>(),
    AhmadPost.find({ status: "published" }).sort({ publishedAt: -1 }).limit(30).lean<PostDoc[]>(),
  ]);
  return NextResponse.json({
    pending: pending.map((d) => toView(d, viewer.userId)),
    published: published.map((d) => toView(d, viewer.userId)),
  });
}

/** body: { text, year?, images[] } — зураг нь /api/uploads-аар (ahmad-image) оруулсан файл */
export async function POST(req: NextRequest) {
  const viewer = await ahmadViewer();
  if (!viewer) return NextResponse.json({ error: "Эхлээд нэвтэрнэ үү" }, { status: 401 });
  if (!viewer.canPost) return NextResponse.json({ error: "Пост бичихэд «Ахмад» эрх хэрэгтэй" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const images: unknown[] = Array.isArray(body?.images) ? body.images : [];
  if (!text && images.length === 0) return NextResponse.json({ error: "Бичвэр эсвэл зураг оруулна уу" }, { status: 400 });
  if (text.length > AHMAD_LIMITS.text) {
    return NextResponse.json({ error: `Бичвэр ${AHMAD_LIMITS.text} тэмдэгтээс ихгүй байна` }, { status: 400 });
  }
  if (images.length > AHMAD_LIMITS.images || !images.every(isAhmadImageUrl)) {
    return NextResponse.json({ error: `${AHMAD_LIMITS.images} хүртэл зураг (энд оруулсан) хавсаргана` }, { status: 400 });
  }

  let year: number | undefined;
  if (body?.year !== undefined && body?.year !== null && body?.year !== "") {
    const value = Number(body.year);
    const latest = Number(todayUb().slice(0, 4));
    if (!Number.isInteger(value) || value < AHMAD_YEAR_MIN || value > latest) {
      return NextResponse.json({ error: `Он ${AHMAD_YEAR_MIN}–${latest} хооронд байна` }, { status: 400 });
    }
    year = value;
  }

  await connectToDatabase();
  const recent = await AhmadPost.countDocuments({ author: viewer.userId, createdAt: { $gt: new Date(Date.now() - 86_400_000) } });
  if (recent >= AHMAD_LIMITS.perDay) {
    return NextResponse.json({ error: `Өдөрт ${AHMAD_LIMITS.perDay} хүртэл пост илгээнэ. Маргааш дахин оролдоно уу.` }, { status: 429 });
  }

  const post = await AhmadPost.create({
    author: viewer.userId,
    authorName: viewer.name,
    text,
    year,
    images: [...new Set(images as string[])],
  });

  // Хянагч, админуудын утсанд мэдэгдэнэ (хариуг саатуулахгүй)
  after(async () => {
    const reviewers = await newsReviewerIds(viewer.userId);
    if (!reviewers.length) return;
    await pushToDevices(
      {
        title: "Ахмадын шинэ пост хянуулахаар ирлээ",
        body: `${viewer.name}${text ? `: ${text.slice(0, 80)}` : ""}`,
        url: "/admin/ahmad",
        tag: `ahmad-${post._id}`,
        kind: "news",
      },
      reviewers
    );
  });

  return NextResponse.json({ post: toView(post.toObject() as PostDoc, viewer.userId) }, { status: 201 });
}
