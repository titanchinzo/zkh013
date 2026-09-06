import { NextResponse } from "next/server";
import { getCurrentRole } from "@/lib/auth-role";

export async function GET() {
  const role = await getCurrentRole();
  return NextResponse.json({ role });
}
