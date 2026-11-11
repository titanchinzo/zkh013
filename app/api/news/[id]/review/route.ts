import { NextRequest, NextResponse, after } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import News from "@/lib/models/News";
import { getActor } from "@/lib/actor";
import { notifyAuthor } from "@/lib/news-notify";

// Хянагч (эсвэл админ) мэдээг зөвшөөрөх/татгалзах — сайтаас эсвэл утсан дээрх аппаас.
// body: { action: "approve" | "reject" }. Зохиогчийн утсанд шийдвэрийг мэдэгдэнэ.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (actor?.role !== "admin" && actor?.role !== "moderator") {
    return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  }

  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  const { action } = (await req.json().catch(() => null)) ?? {};

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Буруу үйлдэл" }, { status: 400 });
  }

  await connectToDatabase();
  const news = await News.findByIdAndUpdate(
    id,
    {
      status: action === "approve" ? "published" : "rejected",
      reviewedBy: actor.userId,
      reviewedAt: new Date(),
    },
    { returnDocument: "after" }
  );

  if (!news) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  if (news.authorId !== actor.userId) after(() => notifyAuthor(news, action === "approve"));
  return NextResponse.json({ news });
}
