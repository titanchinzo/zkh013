import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import ContactMessage from "@/lib/models/ContactMessage";
import { CONTACT_LIMITS } from "@/lib/contact";

// Спам, хэт олон/урт зурвасаар өгөгдлийн санг дүүргэхээс сэргийлэх хязгаар (сүүлийн 1 цагт)
const PER_IP_PER_HOUR = 5;
const TOTAL_PER_HOUR = 200;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Field = keyof typeof CONTACT_LIMITS;
const FIELDS = Object.keys(CONTACT_LIMITS) as Field[];

/** Илгээгчийн IP-ийн hash (IP-г өөрийг нь хадгалахгүй). Vercel x-forwarded-for-ийг өөрөө тавьдаг. */
function senderHash(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const data = {} as Record<Field, string>;
  for (const field of FIELDS) {
    const value = body?.[field];
    data[field] = typeof value === "string" ? value.trim() : "";
  }

  if (FIELDS.some((field) => !data[field])) {
    return NextResponse.json({ error: "Бүх талбарыг бөглөнө үү" }, { status: 400 });
  }
  if (FIELDS.some((field) => data[field].length > CONTACT_LIMITS[field])) {
    return NextResponse.json({ error: "Зурвас хэт урт байна" }, { status: 400 });
  }
  if (!EMAIL_PATTERN.test(data.email)) {
    return NextResponse.json({ error: "И-мэйл хаяг буруу байна" }, { status: 400 });
  }
  // Хүнд харагдахгүй "website" талбарыг зөвхөн бот бөглөнө — амжилттай мэт хариулаад хадгалахгүй
  if (body?.website) return NextResponse.json({ ok: true });

  await connectToDatabase();
  const sender = senderHash(req);
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const [fromSender, total] = await Promise.all([
    ContactMessage.countDocuments({ sender, createdAt: { $gte: since } }),
    ContactMessage.countDocuments({ createdAt: { $gte: since } }),
  ]);
  if (fromSender >= PER_IP_PER_HOUR || total >= TOTAL_PER_HOUR) {
    return NextResponse.json({ error: "Хэт олон зурвас илгээлээ. Түр хүлээгээд дахин оролдоно уу." }, { status: 429 });
  }

  await ContactMessage.create({ ...data, sender });
  return NextResponse.json({ ok: true });
}
