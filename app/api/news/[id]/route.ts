import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import News from "@/lib/models/News";
import { getCurrentRole } from "@/lib/auth-role";
import { createImagePreparer } from "@/lib/image-import";
import { MEDIA_URL_ERROR } from "@/lib/media";
import { prepareMediaUrl } from "@/lib/media-server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connectToDatabase();
  const news = await News.findById(id).lean();
  if (!news) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });

  const role = await getCurrentRole();
  if (news.status !== "published" && !role) {
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
  const body = await req.json();
  const { title, excerpt, content, status } = body ?? {};
  // imageUrl, images, mediaUrl ирээгүй бол (хуучин клиент) одоогийн утгыг нь хэвээр үлдээнэ.
  // Facebook-ийн зургийг манай Blob руу хуулж хадгална.
  const prepare = createImagePreparer();
  const imageUrl = body?.imageUrl === undefined ? undefined : await prepare.image(body.imageUrl);
  if (imageUrl && !imageUrl.ok) return NextResponse.json({ error: imageUrl.error }, { status: 400 });
  const images = body?.images === undefined ? undefined : await prepare.list(body.images);
  if (images && !images.ok) return NextResponse.json({ error: images.error }, { status: 400 });
  const mediaUrl = body?.mediaUrl === undefined ? undefined : await prepareMediaUrl(body.mediaUrl);
  if (mediaUrl === null) {
    return NextResponse.json({ error: MEDIA_URL_ERROR }, { status: 400 });
  }

  await connectToDatabase();
  const news = await News.findByIdAndUpdate(
    id,
    {
      title,
      excerpt,
      content,
      ...(imageUrl ? { imageUrl: imageUrl.value } : {}),
      ...(images ? { images: images.value } : {}),
      ...(mediaUrl !== undefined ? { mediaUrl } : {}),
      ...(status ? { status } : {}),
    },
    { new: true }
  );

  if (!news) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  return NextResponse.json({ news });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = await getCurrentRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  }

  const { id } = await params;
  await connectToDatabase();
  await News.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
