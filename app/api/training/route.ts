import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import TrainingMaterial from "@/lib/models/TrainingMaterial";
import { getCurrentRole } from "@/lib/auth-role";
import { parseTrainingInput } from "@/lib/training";

export async function GET() {
  await connectToDatabase();
  const materials = await TrainingMaterial.find().sort({ createdAt: -1 }).lean();
  return NextResponse.json({ materials });
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  const role = await getCurrentRole();
  if (!user || role !== "admin") {
    return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  }

  const parsed = parseTrainingInput(await req.json().catch(() => null));
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  await connectToDatabase();
  const material = await TrainingMaterial.create({ ...parsed.data, createdBy: user.id });
  return NextResponse.json({ material }, { status: 201 });
}
