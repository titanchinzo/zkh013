import { NextRequest, NextResponse, after } from "next/server";
import { isValidObjectId } from "mongoose";
import ChatDeletion from "@/lib/models/ChatDeletion";
import ChatFile from "@/lib/models/ChatFile";
import ChatMessage from "@/lib/models/ChatMessage";
import ChatReceipt from "@/lib/models/ChatReceipt";
import Personnel from "@/lib/models/Personnel";
import { pushToDevices } from "@/lib/push";
import { personnelLabel } from "@/lib/hr";
import { CHAT_LIMITS, previewText, type ChatFileMeta } from "@/lib/chat-shared";
import { allowSend, approvedLastSeen, getChatUser, isOnline, isUserId, isViewing, markViewing } from "@/lib/chat";
import { fileExpiry, isUploaded } from "@/lib/chat-files";
import { unreadTotal } from "@/lib/chat-group";
import { deletePrivateFile } from "@/lib/storage";

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
 * removed — тэр хүний «хоёулангаас устгасан» зурвасууд: утас түүхээсээ арилгаад /api/app/chat/removed-д мэдэгдэнэ.
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

  const [person, seen, incoming, myUnread, receipt, files, removed] = await Promise.all([
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
    // group: null — бүлгийн чатын устгалыг энд биш (бүлгийн чат өөрөө авна)
    ChatDeletion.find({ recipient: me, sender: other, group: null }).select("messageId").limit(500).lean<{ messageId: string }[]>(),
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
    removed: removed.map((r) => r.messageId),
  });
}

/**
 * Миний илгээсэн зурвасыг хоёулангаас устгана. body: { id, fileId? }. Нөгөө хүн хараахан аваагүй бол серверээс
 * шууд устна; утсандаа аль хэдийн авсан бол (эсвэл авч байх агшинд) дараагийн асуулгаар (removed) түүний утаснаас
 * устна. Хавсаргасан файл серверт байвал мөн устна. Уншаагүй зурвасын мэдэгдлийг дуугүй шинэчилнэ.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await getChatUser();
  if ("error" in auth) return auth.error;
  const { me, person: sender } = auth;
  const { userId: other } = await params;
  if (!isUserId(other) || other === me) return NextResponse.json(NOT_FOUND, { status: 404 });

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" && isValidObjectId(body.id) ? body.id : null;
  if (!id) return NextResponse.json({ error: "Зурвас олдсонгүй" }, { status: 400 });
  if (!allowSend(me)) {
    return NextResponse.json({ error: "Хэт олон удаа устгалаа — түр хүлээгээд дахин оролдоно уу" }, { status: 429 });
  }

  // Хараахан хүргэгдээгүй бол серверээс; хүргэгдсэн бол файлын id-г утас өөрөө мэдэгдэнэ
  const waiting = await ChatMessage.findOneAndDelete({ _id: id, sender: me, recipient: other }).lean<MessageDoc>();
  const fileId = waiting?.file?.id ?? (typeof body?.fileId === "string" && isValidObjectId(body.fileId) ? body.fileId : null);
  if (fileId) {
    const file = await ChatFile.findOneAndDelete({ _id: fileId, sender: me, recipient: other }).select("_id").lean();
    if (file) await deletePrivateFile(String(fileId));
  }
  // Хүлээн авагчийн утас энэ зурвасыг аль хэдийн авсан байж болно — тэр утас дараа нь өөрөө арилгана
  await ChatDeletion.updateOne(
    { recipient: other, sender: me, messageId: id },
    { $setOnInsert: { recipient: other, sender: me, messageId: id } },
    { upsert: true }
  );

  // Уншаагүй зурвасын мэдэгдэлд энэ зурвасын текст харагдаж байж болно — дараагийн уншаагүй зурвасаар солино
  if (waiting && !isViewing(other, me)) {
    after(async () => {
      const latest = await ChatMessage.findOne({ recipient: other, sender: me }).sort({ _id: -1 }).lean<MessageDoc>();
      if (latest && String(latest._id) > id) return; // мэдэгдэлд илүү шинэ зурвас харагдаж байна
      const preview = latest ? previewText(latest) : "Зурвасаа устгасан";
      await pushToDevices(
        {
          kind: "chat",
          title: personnelLabel(sender),
          body: preview.length > 140 ? `${preview.slice(0, 140)}…` : preview,
          url: `/app?chat=${me}`,
          tag: `chat-${me}`,
          icon: sender.photo || undefined,
          badge: await unreadTotal(other),
          silent: true,
        },
        [other]
      );
    });
  }

  return NextResponse.json({ ok: true });
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
        badge: await unreadTotal(other),
      },
      [other]
    );
  });

  return NextResponse.json({ message: toClient(me)(message) }, { status: 201 });
}
