import { NextRequest, NextResponse, after } from "next/server";
import { isValidObjectId } from "mongoose";
import ChatMessage from "@/lib/models/ChatMessage";
import Conversation from "@/lib/models/Conversation";
import Personnel from "@/lib/models/Personnel";
import { pushToDevices } from "@/lib/push";
import { personnelLabel } from "@/lib/hr";
import { CHAT_LIMITS } from "@/lib/chat-shared";
import {
  MESSAGES_PER_MINUTE,
  approvedLastSeen,
  chatKey,
  getChatUser,
  isOnline,
  isUserId,
  isViewing,
  markViewing,
} from "@/lib/chat";

type Params = { params: Promise<{ userId: string }> };
type MessageDoc = { _id: unknown; sender: string; text: string; createdAt: Date };
type ConversationDoc = { _id: unknown; unread?: Record<string, number>; readAt?: Record<string, Date> };

const NOT_FOUND = { error: "Хэрэглэгч олдсонгүй" };
const PAGE = 50;

const toClient = (me: string) => (m: MessageDoc) => ({ id: String(m._id), text: m.text, mine: m.sender === me, at: m.createdAt });

/**
 * Тухайн хүнтэй хийсэн чат. ?after=<id> — тэр зурвасаас хойших шинэ зурвасууд (утас 2.5 с тутам асууна),
 * ?before=<id> — өмнөх зурвасууд (хуудаслах), эс бөгөөс сүүлийн 50. Нээж харсан тул уншсанд тооцно.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await getChatUser();
  if ("error" in auth) return auth.error;
  const { me } = auth;
  const { userId: other } = await params;
  if (!isUserId(other) || other === me) return NextResponse.json(NOT_FOUND, { status: 404 });

  const [person, conversation, seen] = await Promise.all([
    Personnel.findOne({ userId: other })
      .select("rank name position photo active")
      .lean<{ rank: string; name: string; position: string; photo?: string; active: boolean }>(),
    Conversation.findOne({ key: chatKey(me, other) }).select("unread readAt").lean<ConversationDoc>(),
    approvedLastSeen([other]),
  ]);
  if (!person && !conversation) return NextResponse.json(NOT_FOUND, { status: 404 });

  const search = req.nextUrl.searchParams;
  const after = search.get("after");
  const before = search.get("before");
  const limit = Math.min(Math.max(Number(search.get("limit")) || PAGE, 1), 100);
  let messages: MessageDoc[] = [];
  let hasMore = false;
  if (conversation) {
    if (after && isValidObjectId(after)) {
      messages = await ChatMessage.find({ conversation: conversation._id, _id: { $gt: after } })
        .sort({ _id: 1 })
        .limit(200)
        .lean<MessageDoc[]>();
    } else {
      const page = await ChatMessage.find({
        conversation: conversation._id,
        ...(before && isValidObjectId(before) ? { _id: { $lt: before } } : {}),
      })
        .sort({ _id: -1 })
        .limit(limit + 1)
        .lean<MessageDoc[]>();
      hasMore = page.length > limit;
      messages = page.slice(0, limit).reverse();
    }
    if ((conversation.unread?.[me] ?? 0) > 0) {
      await Conversation.updateOne(
        { _id: conversation._id },
        { $set: { [`unread.${me}`]: 0, [`readAt.${me}`]: new Date() } }
      );
    }
  }
  markViewing(me, other);

  // Идэвхгүй болгосон (халагдсан) хүний төлөвийг харуулахгүй
  const lastSeenAt = person?.active ? (seen.get(other) ?? null) : null;
  return NextResponse.json({
    person: {
      userId: other,
      rank: person?.rank ?? "",
      name: person?.name ?? "Хасагдсан хэрэглэгч",
      position: person?.position ?? "",
      photo: person?.photo ?? "",
    },
    online: isOnline(lastSeenAt),
    lastSeenAt,
    canMessage: Boolean(person?.active),
    // Нөгөө хүн хамгийн сүүлд хэзээ уншсан — «Уншсан» гэж харуулна
    readAt: conversation?.readAt?.[other] ?? null,
    messages: messages.map(toClient(me)),
    hasMore,
  });
}

const isDuplicateKey = (err: unknown) => (err as { code?: number })?.code === 11000;

/** Зурвас илгээнэ. body: { text }. Нөгөө хүн тэр чатыг нээж хараагүй бол утсанд нь мэдэгдэл очно. */
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await getChatUser();
  if ("error" in auth) return auth.error;
  const { me, person: sender } = auth;
  const { userId: other } = await params;
  if (!isUserId(other) || other === me) return NextResponse.json(NOT_FOUND, { status: 404 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Зурвас хоосон байна" }, { status: 400 });
  if (text.length > CHAT_LIMITS.text) return NextResponse.json({ error: "Зурвас хэт урт байна" }, { status: 400 });

  const recipient = await Personnel.exists({ userId: other, active: true });
  if (!recipient) return NextResponse.json({ error: "Энэ хүнд зурвас илгээх боломжгүй" }, { status: 404 });
  const recent = await ChatMessage.countDocuments({ sender: me, createdAt: { $gt: new Date(Date.now() - 60_000) } });
  if (recent >= MESSAGES_PER_MINUTE) {
    return NextResponse.json({ error: "Хэт олон зурвас илгээлээ — түр хүлээгээд дахин оролдоно уу" }, { status: 429 });
  }

  const now = new Date();
  const key = chatKey(me, other);
  const update = {
    $setOnInsert: { members: [me, other].sort() },
    // Илгээсэн хүн чатаа харж байгаа тул уншсанд тооцно; нөгөө хүний уншаагүй тоо нэмэгдэнэ
    $set: { lastMessage: { text: text.slice(0, 200), sender: me, at: now }, [`unread.${me}`]: 0, [`readAt.${me}`]: now },
    $inc: { [`unread.${other}`]: 1 },
  };
  // Хоёр хүн анх зэрэг бичвэл нэг нь «давхар түлхүүр» алдаа авна — тэгвэл үүссэн чатыг шинэчилнэ
  const conversation = await Conversation.findOneAndUpdate({ key }, update, { upsert: true, returnDocument: "after" })
    .select("_id")
    .catch((err) => {
      if (isDuplicateKey(err)) return Conversation.findOneAndUpdate({ key }, update, { returnDocument: "after" }).select("_id");
      throw err;
    });
  const message = await ChatMessage.create({ conversation: conversation._id, sender: me, text });

  after(async () => {
    if (isViewing(other, me)) return;
    const unread = await Conversation.find({ members: other })
      .select("unread")
      .lean<{ unread?: Record<string, number> }[]>();
    await pushToDevices(
      {
        kind: "chat",
        title: personnelLabel(sender),
        body: text.length > 140 ? `${text.slice(0, 140)}…` : text,
        url: `/app?chat=${me}`,
        tag: `chat-${me}`,
        icon: sender.photo || undefined,
        badge: unread.reduce((sum, c) => sum + (c.unread?.[other] ?? 0), 0),
      },
      [other]
    );
  });

  return NextResponse.json({ message: toClient(me)(message) }, { status: 201 });
}
