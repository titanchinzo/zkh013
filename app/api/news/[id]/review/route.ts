import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import News from "@/lib/models/News";
import { getCurrentRole } from "@/lib/auth-role";

// Хянагч (эсвэл админ) мэдээг зөвшөөрөх/татгалзах. body: { action: "approve" | "reject" }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = await getCurrentRole();
  if (role !== "admin" && role !== "moderator") {
    return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  }

  const user = await currentUser();
  const { id } = await params;
  const { action } = await req.json();

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Буруу үйлдэл" }, { status: 400 });
  }

  await connectToDatabase();
  const news = await News.findByIdAndUpdate(
    id,
    {
      status: action === "approve" ? "published" : "rejected",
      reviewedBy: user?.id,
      reviewedAt: new Date(),
    },
    { new: true }
  );

  if (!news) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  return NextResponse.json({ news });
}
