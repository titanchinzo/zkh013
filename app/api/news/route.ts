import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import News from "@/lib/models/News";
import { getCurrentRole } from "@/lib/auth-role";
import { isUsableImageUrl } from "@/lib/images";

export async function GET(req: NextRequest) {
  await connectToDatabase();
  const role = await getCurrentRole();
  const wantsAll = req.nextUrl.searchParams.get("all") === "1";

  const filter = wantsAll && role ? {} : { status: "published" };
  const news = await News.find(filter).sort({ createdAt: -1 }).lean();
  return NextResponse.json({ news });
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  const role = await getCurrentRole();

  if (!user || !role) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  }

  const body = await req.json();
  const { title, excerpt, content, imageUrl } = body ?? {};

  if (!title || !excerpt || !content) {
    return NextResponse.json({ error: "Гарчиг, товч тайлбар, агуулгыг бөглөнө үү" }, { status: 400 });
  }
  if (imageUrl && !isUsableImageUrl(imageUrl)) {
    return NextResponse.json({ error: "Зургийн холбоос буруу байна" }, { status: 400 });
  }

  await connectToDatabase();

  // Шинээр оруулсан мэдээ хянагчийн review-г дамжих хэрэгтэй тул үргэлж "pending" төлөвтэй үүснэ.
  // Админ хүсвэл дараа нь шууд нийтлэх (publish) боломжтой.
  const news = await News.create({
    title,
    excerpt,
    content,
    imageUrl: imageUrl ?? "",
    status: "pending",
    authorId: user.id,
    authorName: user.fullName ?? user.primaryEmailAddress?.emailAddress ?? "Тодорхойгүй",
  });

  return NextResponse.json({ news }, { status: 201 });
}
