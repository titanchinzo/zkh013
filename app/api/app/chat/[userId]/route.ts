import { NextRequest, NextResponse, after } from "next/server";
import { isValidObjectId } from "mongoose";
import ChatFile from "@/lib/models/ChatFile";
import ChatMessage from "@/lib/models/ChatMessage";
import ChatReceipt from "@/lib/models/ChatReceipt";
import Personnel from "@/lib/models/Personnel";
import { pushToDevices } from "@/lib/push";
import { personnelLabel } from "@/lib/hr";
import { CHAT_LIMITS, previewText, type ChatFileMeta } from "@/lib/chat-shared";
import { allowSend, approvedLastSeen, getChatUser, isOnline, isUserId, isViewing, markViewing } from "@/lib/chat";
import { fileExpiry, isUploaded } from "@/lib/chat-files";

type Params = { params: Promise<{ userId: string }> };
type MessageDoc = { _id: unknown; sender: string; text: string; file?: ChatFileMeta; ephemeral?: boolean; createdAt: Date };

const NOT_FOUND = { error: "Хэрэглэгч олдсонгүй" };

const toClient = (me: string) => (m: MessageDoc) => ({
  id: String(m._id),
  text: m.text ?? "",
  mine: m.sender === me,
  at: m.createdAt,
  ...(m.file ? { file: m.file } : {}),
  ...(m.ephemeral ? { ephemeral: true } : {}),
});

/**
 * Тухайн хүнтэй хийх чат: тэр хүнээс ирсэн, хараахан уншаагүй зурвасууд. Чатын түүх серверт үлддэггүй — утас
 * зурвасыг өөртөө хадгалаад ?ack=<сүүлийн id>-аар мэдэгдэхэд тэр хүртэлх зурвасуудыг серверээс устгана.
 * unreadFrom — миний илгээснээс нөгөө хүн хараахан уншаагүй хамгийн эртний зурвас (түүнээс өмнөх нь уншигдсан).
 * readUpTo — нөгөө хүн миний зурвасыг хэзээ хүртэл уншсан («Уншаад 2 минутад устах» зурвасыг хоёр утас устгахад).
 * files — бидний хооронд илгээсэн файлуудын төлөв (татаж авсан эсэх).
 */
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await getChatUser();
  if ("error" in auth) return auth.error;
  const { me } = auth;
  const { userId: other } = await params;
  if (!isUserId(other) || other === me) return NextResponse.json(NOT_FOUND, { status: 404 });

  const ack = req.nextUrl.searchParams.get("ack");
  if (ack && isValidObjectId(ack)) {
    const { deletedCount } = await ChatMessage.deleteMany({ recipient: me, sender: other, _id: { $lte: ack } });
    if (deletedCount) {
      await ChatReceipt.updateOne({ reader: me, sender: other }, { $set: { upTo: ack, at: new Date() } }, { upsert: true });
    }
  }

  const [person, seen, incoming, myUnread, receipt, files] = await Promise.all([
    Personnel.findOne({ userId: other })
      .select("rank name position group photo active")
      .lean<{ rank: string; name: string; position: string; group?: string; photo?: string; active: boolean }>(),
    approvedLastSeen([other]),
    ChatMessage.find({ recipient: me, sender: other }).sort({ _id: 1 }).limit(200).lean<MessageDoc[]>(),
    ChatMessage.findOne({ recipient: other, sender: me }).sort({ _id: 1 }).select("_id").lean<{ _id: unknown }>(),
    ChatReceipt.findOne({ reader: other, sender: me }).select("upTo at").lean<{ upTo: string; at: Date }>(),
    ChatFile.find({
      $or: [
        { sender: me, recipient: other },
        { sender: other, recipient: me },
      ],
      status: { $ne: "uploading" },
      expiresAt: { $gt: new Date() },
    })
      .select("status")
      .lean<{ _id: unknown; status: string }[]>(),
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
      position: person?.position || person?.group || "",
      photo: person?.photo ?? "",
    },
    online: isOnline(lastSeenAt),
    lastSeenAt,
    canMessage: Boolean(person?.active),
    messages: incoming.map(toClient(me)),
    unreadFrom: myUnread ? String(myUnread._id) : null,
    readUpTo: receipt ? { id: receipt.upTo, at: receipt.at } : null,
    files: files.map((f) => ({ id: String(f._id), status: f.status })),
  });
}

/**
 * Зурвас илгээнэ. body: { text?, fileId?, ephemeral? } — fileId: /files-аар эхлүүлж бүрэн оруулсан файл; ephemeral:
 * уншсанаас хойш 2 минутад хоёр утаснаас устна. Нөгөө хүн тэр чатыг нээж хараагүй бол утсанд нь мэдэгдэл очно.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await getChatUser();
  if ("error" in auth) return auth.error;
  const { me, person: sender } = auth;
  const { userId: other } = await params;
  if (!isUserId(other) || other === me) return NextResponse.json(NOT_FOUND, { status: 404 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const fileId = typeof body?.fileId === "string" && isValidObjectId(body.fileId) ? body.fileId : null;
  const ephemeral = body?.ephemeral === true;
  if (!text && !fileId) return NextResponse.json({ error: "Зурвас хоосон байна" }, { status: 400 });
  if (text.length > CHAT_LIMITS.text) return NextResponse.json({ error: "Зурвас хэт урт байна" }, { status: 400 });

  const recipient = await Personnel.exists({ userId: other, active: true });
  if (!recipient) return NextResponse.json({ error: "Энэ хүнд зурвас илгээх боломжгүй" }, { status: 404 });
  if (!allowSend(me)) {
    return NextResponse.json({ error: "Хэт олон зурвас илгээлээ — түр хүлээгээд дахин оролдоно уу" }, { status: 429 });
  }

  let file: ChatFileMeta | undefined;
  if (fileId) {
    const doc = await ChatFile.findOne({ _id: fileId, sender: me, recipient: other, status: "uploading" });
    if (!doc || !(await isUploaded(doc))) {
      return NextResponse.json({ error: "Файл бүрэн оруулагдаагүй байна" }, { status: 400 });
    }
    doc.set({ status: "ready", expiresAt: fileExpiry.ready() });
    await doc.save();
    file = { id: fileId, name: doc.name, size: doc.size, type: doc.type };
  }

  const message = await ChatMessage.create({ sender: me, recipient: other, text, file, ephemeral });

  after(async () => {
    if (isViewing(other, me)) return;
    const preview = previewText({ text, file, ephemeral });
    await pushToDevices(
      {
        kind: "chat",
        title: personnelLabel(sender),
        body: preview.length > 140 ? `${preview.slice(0, 140)}…` : preview,
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
