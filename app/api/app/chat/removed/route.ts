import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import ChatDeletion from "@/lib/models/ChatDeletion";
import { getChatUser } from "@/lib/chat";

/** Илгээгчийн устгасан зурвасуудыг утас өөрийн түүхээс арилгасныг баталгаажуулна. body: { ids: string[] } */
export async function POST(req: NextRequest) {
  const auth = await getChatUser();
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => typeof id === "string" && isValidObjectId(id)).slice(0, 500) : [];
  if (ids.length) await ChatDeletion.deleteMany({ recipient: auth.me, messageId: { $in: ids } });
  return NextResponse.json({ ok: true });
}
