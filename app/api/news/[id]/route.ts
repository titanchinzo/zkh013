import { NextRequest, NextResponse } from "next/server";
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
  const query = News.findById(id);
  const news = await (role ? query : query.select(STAFF_ONLY_FIELDS)).lean();
  if (!news || (news.status !== "published" && !role)) {
    return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  }

  return NextResponse.json({ news });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = await getCurrentRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  }

  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
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

  await connectToDatabase();
  const previous = await News.findById(id).select("imageUrl images videos").lean();
  const news = await News.findByIdAndUpdate(
    id,
    {
      title,
      excerpt,
      content,
      ...(imageUrl ? { imageUrl: imageUrl.value } : {}),
      ...(images ? { images: images.value } : {}),
      ...(videos ? { videos: videos.value } : {}),
      ...(mediaUrl !== undefined ? { mediaUrl } : {}),
      ...(status ? { status } : {}),
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
