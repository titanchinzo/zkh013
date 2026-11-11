import { NextRequest, NextResponse, after } from "next/server";
import { isValidObjectId } from "mongoose";
import ChatMessage from "@/lib/models/ChatMessage";
import Personnel from "@/lib/models/Personnel";
import { pushToDevices } from "@/lib/push";
import { personnelLabel } from "@/lib/hr";
import { CHAT_LIMITS } from "@/lib/chat-shared";
import { allowSend, approvedLastSeen, getChatUser, isOnline, isUserId, isViewing, markViewing } from "@/lib/chat";

type Params = { params: Promise<{ userId: string }> };
type MessageDoc = { _id: unknown; sender: string; text: string; createdAt: Date };

const NOT_FOUND = { error: "Хэрэглэгч олдсонгүй" };

const toClient = (me: string) => (m: MessageDoc) => ({ id: String(m._id), text: m.text, mine: m.sender === me, at: m.createdAt });

/**
 * Тухайн хүнтэй хийх чат: тэр хүнээс ирсэн, хараахан уншаагүй зурвасууд. Чатын түүх серверт үлддэггүй — утас
 * зурвасыг өөртөө хадгалаад ?ack=<сүүлийн id>-аар мэдэгдэхэд тэр хүртэлх зурвасуудыг серверээс устгана.
 * unreadFrom — миний илгээснээс нөгөө хүн хараахан уншаагүй хамгийн эртний зурвас (түүнээс өмнөх нь уншигдсан).
 */
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await getChatUser();
  if ("error" in auth) return auth.error;
  const { me } = auth;
  const { userId: other } = await params;
  if (!isUserId(other) || other === me) return NextResponse.json(NOT_FOUND, { status: 404 });

  const ack = req.nextUrl.searchParams.get("ack");
  if (ack && isValidObjectId(ack)) {
    await ChatMessage.deleteMany({ recipient: me, sender: other, _id: { $lte: ack } });
  }

  const [person, seen, incoming, myUnread] = await Promise.all([
    Personnel.findOne({ userId: other })
      .select("rank name position photo active")
      .lean<{ rank: string; name: string; position: string; photo?: string; active: boolean }>(),
    approvedLastSeen([other]),
    ChatMessage.find({ recipient: me, sender: other }).sort({ _id: 1 }).limit(200).lean<MessageDoc[]>(),
    ChatMessage.findOne({ recipient: other, sender: me }).sort({ _id: 1 }).select("_id").lean<{ _id: unknown }>(),
  ]);
  if (!person && !incoming.length) return NextResponse.json(NOT_FOUND, { status: 404 });
  markViewing(me, other);

  // Идэвхгүй болгосон (халагдсан) хүний төлөвийг харуулахгүй
  const lastSeenAt = person?.active ? (seen.get(other) ?? null) : null;
  return NextResponse.json({
    me,
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
    messages: incoming.map(toClient(me)),
    unreadFrom: myUnread ? String(myUnread._id) : null,
  });
}

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
  if (!allowSend(me)) {
    return NextResponse.json({ error: "Хэт олон зурвас илгээлээ — түр хүлээгээд дахин оролдоно уу" }, { status: 429 });
  }

  const message = await ChatMessage.create({ sender: me, recipient: other, text });

  after(async () => {
    if (isViewing(other, me)) return;
    await pushToDevices(
      {
        kind: "chat",
        title: personnelLabel(sender),
        body: text.length > 140 ? `${text.slice(0, 140)}…` : text,
        url: `/app?chat=${me}`,
        tag: `chat-${me}`,
        icon: sender.photo || undefined,
        badge: await ChatMessage.countDocuments({ recipient: other }),
      },
      [other]
    );
  });

  return NextResponse.json({ message: toClient(me)(message) }, { status: 201 });
}
