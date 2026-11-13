import { NextRequest, NextResponse } from "next/server";
import { getChatUser } from "@/lib/chat";
import { startChatFile } from "@/lib/chat-files";
import { loadGroup } from "@/lib/chat-group";

type Params = { params: Promise<{ groupId: string }> };

/**
 * Бүлгийн чатад файл илгээхийг эхлүүлнэ (зөвхөн гишүүн). body: { name, size, type } → { fileId, uploadId, chunkSize }.
 * Дараа нь POST /api/app/chat/group/<groupId> { fileId }-аар зурвас болгон илгээнэ.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await getChatUser();
  if ("error" in auth) return auth.error;
  const { groupId } = await params;
  if (!(await loadGroup(groupId, auth.me))) {
    return NextResponse.json({ error: "Бүлэг олдсонгүй эсвэл та түүний гишүүн биш байна" }, { status: 404 });
  }
  return startChatFile(auth.me, await req.json().catch(() => null), { group: groupId });
}
