import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import AhmadPost from "@/lib/models/AhmadPost";

/** Зүрх дарах / болих — сайтад нэвтэрсэн хүн, нийтлэгдсэн пост. body: { hearted: boolean } (хүссэн төлөв) */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Зүрх дарахын тулд нэвтэрнэ үү" }, { status: 401 });
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  const hearted = (await req.json().catch(() => null))?.hearted;
  if (typeof hearted !== "boolean") return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });

  await connectToDatabase();
  const post = await AhmadPost.findOneAndUpdate(
    { _id: id, status: "published" },
    hearted ? { $addToSet: { hearts: userId } } : { $pull: { hearts: userId } },
    { returnDocument: "after" }
  )
    .select("hearts")
    .lean<{ hearts: string[] }>();
  if (!post) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  return NextResponse.json({ hearts: post.hearts.length, hearted: post.hearts.includes(userId) });
}
