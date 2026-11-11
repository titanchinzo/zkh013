import { NextRequest, NextResponse, after } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import News, { STAFF_ONLY_FIELDS } from "@/lib/models/News";
import { getActor } from "@/lib/actor";
import { notifyReviewers } from "@/lib/news-notify";
import { isNewsRole } from "@/lib/roles";
import { createImagePreparer } from "@/lib/image-import";
import { MEDIA_URL_ERROR } from "@/lib/media";
import { prepareMediaUrl } from "@/lib/media-server";
import { parseNewsVideos } from "@/lib/news-files";
import { warmMgl } from "@/lib/mgl/convert";

export async function GET(req: NextRequest) {
  await connectToDatabase();
  const actor = await getActor();
  const role = actor?.role ?? null;
  // Хүний нөөц мэдээтэй ажиллахгүй — нийтийн жагсаалтыг л харна
  const staff = isNewsRole(role);
  const wantsAll = req.nextUrl.searchParams.get("all") === "1";

  // Нийтлэгч ажлын жагсаалтад зөвхөн өөрийн оруулсан мэдээг харна
  const own = role === "publisher" ? { authorId: actor!.userId } : {};
  const filter = wantsAll && staff ? own : { status: "published" };
  const query = News.find(filter).sort({ createdAt: -1 });
  const news = await (staff ? query : query.select(STAFF_ONLY_FIELDS)).lean();
  return NextResponse.json({ news });
}

export async function POST(req: NextRequest) {
  // Сайтаас (Clerk) эсвэл утсан дээрх аппаас (зөвшөөрөгдсөн утас) — эрх нь Clerk-ийн role
  const actor = await getActor();
  if (!actor || !isNewsRole(actor.role)) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  }

  const body = await req.json();
  const { title, excerpt, content } = body ?? {};

  if (!title || !excerpt || !content) {
    return NextResponse.json({ error: "Гарчиг, товч тайлбар, агуулгыг бөглөнө үү" }, { status: 400 });
  }
  // Facebook-ийн зургийг манайд (сервер эсвэл Vercel Blob) хуулж хадгална
  const prepare = createImagePreparer();
  const imageUrl = await prepare.image(body?.imageUrl);
  if (!imageUrl.ok) return NextResponse.json({ error: imageUrl.error }, { status: 400 });
  const images = await prepare.list(body?.images);
  if (!images.ok) return NextResponse.json({ error: images.error }, { status: 400 });
  const videos = parseNewsVideos(body?.videos);
  if (!videos.ok) return NextResponse.json({ error: videos.error }, { status: 400 });
  const mediaUrl = await prepareMediaUrl(body?.mediaUrl);
  if (mediaUrl === null) {
    return NextResponse.json({ error: MEDIA_URL_ERROR }, { status: 400 });
  }

  await connectToDatabase();

  // Шинээр оруулсан мэдээ хянагчийн review-г дамжих хэрэгтэй тул үргэлж "pending" төлөвтэй үүснэ.
  // Админ хүсвэл дараа нь шууд нийтлэх (publish) боломжтой.
  const news = await News.create({
    title,
    excerpt,
    content,
    imageUrl: imageUrl.value,
    images: images.value,
    videos: videos.value,
    mediaUrl,
    status: "pending",
    authorId: actor.userId,
    authorName: actor.name,
  });
  // Хянагчдын утсанд «Хянах мэдээ» мэдэгдэл
  after(() => notifyReviewers(news));

  // Монгол бичгийн хувилбарыг хариу илгээсний дараа бэлдэнэ
  warmMgl([title, excerpt, content]);
  return NextResponse.json({ news }, { status: 201 });
}
