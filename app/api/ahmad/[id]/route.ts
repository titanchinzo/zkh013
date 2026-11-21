import { NextRequest, NextResponse, after } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import AhmadPost from "@/lib/models/AhmadPost";
import { ahmadViewer } from "@/lib/ahmad-server";
import { deleteFile } from "@/lib/storage";

/** Постыг устгана — бичсэн хүн өөрөө эсвэл хянагч, админ. Зургууд нь хамт устна. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await ahmadViewer();
  if (!viewer) return NextResponse.json({ error: "Эхлээд нэвтэрнэ үү" }, { status: 401 });
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });

  await connectToDatabase();
  const post = await AhmadPost.findById(id).select("author images").lean<{ author: string; images: string[] }>();
  if (!post) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  if (post.author !== viewer.userId && !viewer.canReview) {
    return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  }
  await AhmadPost.deleteOne({ _id: id });
  after(async () => {
    for (const url of post.images ?? []) await deleteFile(url).catch(() => {});
  });
  return NextResponse.json({ ok: true });
}
