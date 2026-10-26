import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import News, { STAFF_ONLY_FIELDS } from "@/lib/models/News";
import { getCurrentRole } from "@/lib/auth-role";
import { createImagePreparer } from "@/lib/image-import";
import { MEDIA_URL_ERROR } from "@/lib/media";
import { prepareMediaUrl } from "@/lib/media-server";
import { deleteRemovedFiles, parseNewsVideos } from "@/lib/news-files";
import { warmMgl } from "@/lib/mgl/convert";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  await connectToDatabase();
  const role = await getCurrentRole();
  // Нийтлэгч зөвхөн өөрийн мэдээг ажилтны эрхээр (нийтлэгдээгүй ч) харна
  const staff =
    role === "publisher" ? Boolean(await News.exists({ _id: id, authorId: (await auth()).userId })) : Boolean(role);
  const query = News.findById(id);
  const news = await (staff ? query : query.select(STAFF_ONLY_FIELDS)).lean();
  if (!news || (news.status !== "published" && !staff)) {
    return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  }

  return NextResponse.json({ news });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = await getCurrentRole();
  if (role !== "admin" && role !== "publisher") {
    return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  }

  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  // Нийтлэгч зөвхөн өөрийн, хараахан нийтлэгдээгүй мэдээг засна; засварласан мэдээ дахин хяналтад орно
  const target =
    role === "publisher" ? { _id: id, authorId: (await auth()).userId, status: { $ne: "published" } } : { _id: id };
  await connectToDatabase();
  if (role === "publisher" && !(await News.exists(target))) {
    return NextResponse.json({ error: "Зөвхөн өөрийн, нийтлэгдээгүй мэдээг засах боломжтой" }, { status: 403 });
  }
  const body = await req.json();
  const { title, excerpt, content, status } = body ?? {};
  // imageUrl, images, videos, mediaUrl ирээгүй бол (хуучин клиент) одоогийн утгыг нь хэвээр үлдээнэ.
  // Facebook-ийн зургийг манайд (сервер эсвэл Vercel Blob) хуулж хадгална.
  const prepare = createImagePreparer();
  const imageUrl = body?.imageUrl === undefined ? undefined : await prepare.image(body.imageUrl);
  if (imageUrl && !imageUrl.ok) return NextResponse.json({ error: imageUrl.error }, { status: 400 });
  const images = body?.images === undefined ? undefined : await prepare.list(body.images);
  if (images && !images.ok) return NextResponse.json({ error: images.error }, { status: 400 });
  const videos = body?.videos === undefined ? undefined : parseNewsVideos(body.videos);
  if (videos && !videos.ok) return NextResponse.json({ error: videos.error }, { status: 400 });
  const mediaUrl = body?.mediaUrl === undefined ? undefined : await prepareMediaUrl(body.mediaUrl);
  if (mediaUrl === null) {
    return NextResponse.json({ error: MEDIA_URL_ERROR }, { status: 400 });
  }

  const previous = await News.findOne(target).select("imageUrl images videos").lean();
  const news = await News.findOneAndUpdate(
    target,
    {
      title,
      excerpt,
      content,
      ...(imageUrl ? { imageUrl: imageUrl.value } : {}),
      ...(images ? { images: images.value } : {}),
      ...(videos ? { videos: videos.value } : {}),
      ...(mediaUrl !== undefined ? { mediaUrl } : {}),
      ...(role === "publisher" ? { status: "pending" } : status ? { status } : {}),
    },
    { new: true }
  );

  if (!news) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  // Мэдээнээс хассан зураг, бичлэгийг серверийн дискнээс устгана
  if (previous) await deleteRemovedFiles(previous, news);
  // Монгол бичгийн хувилбарыг хариу илгээсний дараа бэлдэнэ
  warmMgl([news.title, news.excerpt, news.content]);
  return NextResponse.json({ news });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = await getCurrentRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  }

  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  await connectToDatabase();
  const deleted = await News.findByIdAndDelete(id).lean();
  if (deleted) await deleteRemovedFiles(deleted, null);
  return NextResponse.json({ ok: true });
}
