import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import News, { STAFF_ONLY_FIELDS } from "@/lib/models/News";
import { getCurrentRole } from "@/lib/auth-role";
import { createImagePreparer } from "@/lib/image-import";
import { MEDIA_URL_ERROR } from "@/lib/media";
import { prepareMediaUrl } from "@/lib/media-server";
import { warmMgl } from "@/lib/mgl/convert";

export async function GET(req: NextRequest) {
  await connectToDatabase();
  const role = await getCurrentRole();
  const wantsAll = req.nextUrl.searchParams.get("all") === "1";

  const filter = wantsAll && role ? {} : { status: "published" };
  const query = News.find(filter).sort({ createdAt: -1 });
  const news = await (role ? query : query.select(STAFF_ONLY_FIELDS)).lean();
  return NextResponse.json({ news });
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  const role = await getCurrentRole();

  if (!user || !role) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  }

  const body = await req.json();
  const { title, excerpt, content } = body ?? {};

  if (!title || !excerpt || !content) {
    return NextResponse.json({ error: "Гарчиг, товч тайлбар, агуулгыг бөглөнө үү" }, { status: 400 });
  }
  // Facebook-ийн зургийг манай Blob руу хуулж хадгална
  const prepare = createImagePreparer();
  const imageUrl = await prepare.image(body?.imageUrl);
  if (!imageUrl.ok) return NextResponse.json({ error: imageUrl.error }, { status: 400 });
  const images = await prepare.list(body?.images);
  if (!images.ok) return NextResponse.json({ error: images.error }, { status: 400 });
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
    mediaUrl,
    status: "pending",
    authorId: user.id,
    authorName: user.fullName ?? user.primaryEmailAddress?.emailAddress ?? "Тодорхойгүй",
  });

  // Монгол бичгийн хувилбарыг хариу илгээсний дараа бэлдэнэ
  warmMgl([title, excerpt, content]);
  return NextResponse.json({ news }, { status: 201 });
}
