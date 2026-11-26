import { NextRequest, NextResponse } from "next/server";
import Personnel from "@/lib/models/Personnel";
import { getChatUser, isUserId } from "@/lib/chat";
import { chatAccess, CLOSED_ERROR, CLOSED_STATUS } from "@/lib/chat-access";
import { startChatFile } from "@/lib/chat-files";

type Params = { params: Promise<{ userId: string }> };

/**
 * Тухайн хүнд файл илгээхийг эхлүүлнэ. body: { name, size, type } → { fileId, uploadId, chunkSize }.
 * Утас файлыг 4MB-аар хэсэгчлэн PUT /api/uploads/<uploadId>-руу илгээж дуусгаад, POST /api/app/chat/<userId>
 * { fileId }-аар зурвас болгон илгээнэ. Файл нийтэд нээгдэхгүй хувийн хавтсанд хадгалагдана. Удирдлагад өмнө
 * бичилцээгүй бол түрүүлж илгээхгүй (lib/chat-access.ts).
 */
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await getChatUser();
  if ("error" in auth) return auth.error;
  const { me, person } = auth;
  const { userId: other } = await params;
  if (!isUserId(other) || other === me) return NextResponse.json({ error: "Хэрэглэгч олдсонгүй" }, { status: 404 });
  const recipient = await Personnel.findOne({ userId: other, active: true })
    .select("group hidePhone")
    .lean<{ group?: string; hidePhone?: boolean }>();
  if (!recipient) return NextResponse.json({ error: "Энэ хүнд файл илгээх боломжгүй" }, { status: 404 });
  if ((await chatAccess(person, { userId: other, ...recipient })).blocked) {
    return NextResponse.json({ error: CLOSED_ERROR }, { status: CLOSED_STATUS });
  }
  return startChatFile(me, await req.json().catch(() => null), { recipient: other });
}
