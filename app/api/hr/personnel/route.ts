import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Personnel from "@/lib/models/Personnel";
import { getCurrentRole } from "@/lib/auth-role";
import { isHrRole } from "@/lib/roles";
import { parsePersonnel } from "@/lib/hr";

const FORBIDDEN = { error: "Зөвшөөрөлгүй" };

export async function GET() {
  if (!isHrRole(await getCurrentRole())) return NextResponse.json(FORBIDDEN, { status: 403 });
  await connectToDatabase();
  const personnel = await Personnel.find().sort({ active: -1, name: 1 }).lean();
  return NextResponse.json({ personnel });
}

export async function POST(req: NextRequest) {
  if (!isHrRole(await getCurrentRole())) return NextResponse.json(FORBIDDEN, { status: 403 });
  const parsed = parsePersonnel(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  await connectToDatabase();
  const person = await Personnel.create(parsed.value);
  return NextResponse.json({ person }, { status: 201 });
}
