import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import ContactMessage from "@/lib/models/ContactMessage";
import { getCurrentRole } from "@/lib/auth-role";

// Сайтын «Холбоо барих» маягтаар ирсэн зурвасууд — зөвхөн админ уншина
export async function GET() {
  if ((await getCurrentRole()) !== "admin") return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  await connectToDatabase();
  // sender — илгээгчийн IP-ийн hash, зөвхөн хязгаарлалтад хэрэгтэй
  const messages = await ContactMessage.find().sort({ createdAt: -1 }).limit(300).select("-sender").lean();
  return NextResponse.json({ messages });
}
