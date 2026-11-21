import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import AhmadPost from "@/lib/models/AhmadPost";
import { ahmadViewer, toView, type PostDoc } from "@/lib/ahmad-server";
import { warmMgl } from "@/lib/mgl/convert";

/** Хянагч, админ: body { action: "approve" | "reject" } — зөвшөөрвөл нийтэд гарна, буцаавал зөвхөн бичсэн хүнд харагдана */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await ahmadViewer();
  if (!viewer?.canReview) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  const action = (await req.json().catch(() => null))?.action;
  if (action !== "approve" && action !== "reject") return NextResponse.json({ error: "Буруу үйлдэл" }, { status: 400 });

  await connectToDatabase();
  const post = await AhmadPost.findById(id);
  if (!post) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  post.status = action === "approve" ? "published" : "rejected";
  post.reviewedBy = viewer.userId;
  post.reviewedAt = new Date();
  if (action === "approve" && !post.publishedAt) post.publishedAt = new Date();
  await post.save();

  // Монгол бичгийн хувилбарыг урьдчилан бэлдэнэ
  if (action === "approve") warmMgl([post.text, post.authorName].filter(Boolean));
  return NextResponse.json({ post: toView(post.toObject() as PostDoc, viewer.userId) });
}
