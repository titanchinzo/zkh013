import { NextRequest, NextResponse } from "next/server";
import Personnel from "@/lib/models/Personnel";
import { getChatUser, isUserId } from "@/lib/chat";
import { startChatFile } from "@/lib/chat-files";

type Params = { params: Promise<{ userId: string }> };

/**
 * Тухайн хүнд файл илгээхийг эхлүүлнэ. body: { name, size, type } → { fileId, uploadId, chunkSize }.
 * Утас файлыг 4MB-аар хэсэгчлэн PUT /api/uploads/<uploadId>-руу илгээж дуусгаад, POST /api/app/chat/<userId>
 * { fileId }-аар зурвас болгон илгээнэ. Файл нийтэд нээгдэхгүй хувийн хавтсанд хадгалагдана.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await getChatUser();
  if ("error" in auth) return auth.error;
  const { me } = auth;
  const { userId: other } = await params;
  if (!isUserId(other) || other === me) return NextResponse.json({ error: "Хэрэглэгч олдсонгүй" }, { status: 404 });
  if (!(await Personnel.exists({ userId: other, active: true }))) {
    return NextResponse.json({ error: "Энэ хүнд файл илгээх боломжгүй" }, { status: 404 });
  }
  return startChatFile(me, await req.json().catch(() => null), { recipient: other });
}
