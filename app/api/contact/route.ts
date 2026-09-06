import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import ContactMessage from "@/lib/models/ContactMessage";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, subject, message } = body ?? {};

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: "Бүх талбарыг бөглөнө үү" }, { status: 400 });
  }

  await connectToDatabase();
  await ContactMessage.create({ name, email, subject, message });

  return NextResponse.json({ ok: true });
}
