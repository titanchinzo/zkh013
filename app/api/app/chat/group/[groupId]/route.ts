import { NextRequest, NextResponse, after } from "next/server";
import { isValidObjectId } from "mongoose";
import ChatDeletion from "@/lib/models/ChatDeletion";
import ChatFile from "@/lib/models/ChatFile";
import ChatMessage from "@/lib/models/ChatMessage";
import { CHAT_LIMITS, groupChatId, previewText, type ChatFileMeta } from "@/lib/chat-shared";
import { allowSend, approvedLastSeen, getChatUser, isOnline, markViewing } from "@/lib/chat";
import { fileExpiry, isUploaded } from "@/lib/chat-files";
import { loadGroup, memberLabel, notifyGroup, type ChatGroup } from "@/lib/chat-group";
import { deletePrivateFile } from "@/lib/storage";

type Params = { params: Promise<{ groupId: string }> };
type MessageDoc = { _id: unknown; sender: string; text: string; file?: ChatFileMeta; readBy?: string[]; createdAt: Date };

const NOT_FOUND = { error: "Бүлэг олдсонгүй эсвэл та түүний гишүүн биш байна" };

/** Зурвасыг утсанд өгөх хэлбэр — from: илгээгч (бүлгийн чатад хэн бичсэн нь харагдана) */
const toClient = (me: string, group: ChatGroup) => {
  const labelOf = new Map(group.members.map((m) => [m.userId, memberLabel(m)]));
  return (m: MessageDoc) => ({
    id: String(m._id),
    text: m.text ?? "",
    mine: m.sender === me,
    at: m.createdAt,
    from: { userId: m.sender, name: labelOf.get(m.sender) ?? "Бүлгээс гарсан гишүүн" },
    ...(m.file ? { file: m.file } : {}),
  });
};

/**
 * Бүлгийн чат: бусад гишүүдийн илгээсэн, миний хараахан уншаагүй зурвасууд. ?ack=<сүүлийн id> — тэр хүртэлх зурвасыг
 * уншсан гэж тэмдэглэнэ (readBy); бүх гишүүн уншсан зурвас серверээс устна. unreadFrom — миний илгээснээс бүх гишүүн
 * хараахан уншаагүй хамгийн эртний зурвас; reads — миний хүлээгдэж буй зурвас бүрийг хэдэн гишүүн уншсан.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await getChatUser();
  if ("error" in auth) return auth.error;
  const { me } = auth;
  const { groupId } = await params;
  const group = await loadGroup(groupId, me);
  if (!group) return NextResponse.json(NOT_FOUND, { status: 404 });
  const memberIds = group.members.map((m) => m.userId);

  const ack = req.nextUrl.searchParams.get("ack");
  if (ack && isValidObjectId(ack)) {
    const { modifiedCount } = await ChatMessage.updateMany(
      { group: groupId, _id: { $lte: ack }, readBy: { $ne: me } },
      { $addToSet: { readBy: me } }
    );
    if (modifiedCount) await ChatMessage.deleteMany({ group: groupId, readBy: { $all: memberIds } });
  }

  const [seen, incoming, mine, files, removed] = await Promise.all([
    approvedLastSeen(memberIds),
    ChatMessage.find({ group: groupId, readBy: { $ne: me } }).sort({ _id: 1 }).limit(200).lean<MessageDoc[]>(),
    ChatMessage.find({ group: groupId, sender: me })
      .sort({ _id: 1 })
      .select("_id readBy")
      .lean<{ _id: unknown; readBy?: string[] }[]>(),
    ChatFile.find({ group: groupId, status: { $ne: "uploading" }, expiresAt: { $gt: new Date() } })
      .select("sender status downloadedBy")
      .lean<{ _id: unknown; sender: string; status: string; downloadedBy?: string[] }[]>(),
    ChatDeletion.find({ recipient: me, group: groupId }).select("messageId").limit(500).lean<{ messageId: string }[]>(),
  ]);
  markViewing(me, groupChatId(groupId));

  const now = Date.now();
  return NextResponse.json({
    me,
    group: {
      id: groupId,
      name: group.name,
      members: group.members.map((m) => ({ ...m, online: isOnline(seen.get(m.userId), now) })),
    },
    canMessage: true,
    messages: incoming.map(toClient(me, group)),
    unreadFrom: mine.length ? String(mine[0]._id) : null,
    reads: Object.fromEntries(mine.map((m) => [String(m._id), Math.max(0, (m.readBy?.length ?? 1) - 1)])),
    files: files.map((f) => ({
      id: String(f._id),
      // Илгээгчид: бүх гишүүн татмагц; гишүүнд: өөрөө татмагц «татаж авсан»
      status: f.status === "downloaded" || (f.sender !== me && f.downloadedBy?.includes(me)) ? "downloaded" : "ready",
    })),
    removed: removed.map((r) => r.messageId),
  });
}

/** Бүлэгт зурвас илгээнэ. body: { text?, fileId? }. Чатыг нээгээгүй гишүүдийн утсанд мэдэгдэл очно. */
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await getChatUser();
  if ("error" in auth) return auth.error;
  const { me, person: sender } = auth;
  const { groupId } = await params;
  const group = await loadGroup(groupId, me);
  if (!group) return NextResponse.json(NOT_FOUND, { status: 404 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const fileId = typeof body?.fileId === "string" && isValidObjectId(body.fileId) ? body.fileId : null;
  if (!text && !fileId) return NextResponse.json({ error: "Зурвас хоосон байна" }, { status: 400 });
  if (text.length > CHAT_LIMITS.text) return NextResponse.json({ error: "Зурвас хэт урт байна" }, { status: 400 });
  if (!allowSend(me)) {
    return NextResponse.json({ error: "Хэт олон зурвас илгээлээ — түр хүлээгээд дахин оролдоно уу" }, { status: 429 });
  }

  let file: ChatFileMeta | undefined;
  if (fileId) {
    const doc = await ChatFile.findOne({ _id: fileId, sender: me, group: groupId, status: "uploading" });
    if (!doc || !(await isUploaded(doc))) {
      return NextResponse.json({ error: "Файл бүрэн оруулагдаагүй байна" }, { status: 400 });
    }
    doc.set({ status: "ready", expiresAt: fileExpiry.ready() });
    await doc.save();
    file = { id: fileId, name: doc.name, size: doc.size, type: doc.type };
  }

  const message = await ChatMessage.create({ sender: me, group: groupId, text, file, readBy: [me] });
  after(() => notifyGroup(group, sender, `${memberLabel(sender)}: ${previewText({ text, file })}`));
  return NextResponse.json({ message: toClient(me, group)(message) }, { status: 201 });
}

/**
 * Миний илгээсэн зурвасыг бүх гишүүнээс устгана. body: { id, fileId? }. Хараахан бүгд уншаагүй бол серверээс устна;
 * утсандаа авсан гишүүдийн утаснаас дараагийн асуулгаар (removed) устна. Файл серверт байвал мөн устна.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await getChatUser();
  if ("error" in auth) return auth.error;
  const { me, person: sender } = auth;
  const { groupId } = await params;
  const group = await loadGroup(groupId, me);
  if (!group) return NextResponse.json(NOT_FOUND, { status: 404 });

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" && isValidObjectId(body.id) ? body.id : null;
  if (!id) return NextResponse.json({ error: "Зурвас олдсонгүй" }, { status: 400 });
  if (!allowSend(me)) {
    return NextResponse.json({ error: "Хэт олон удаа устгалаа — түр хүлээгээд дахин оролдоно уу" }, { status: 429 });
  }

  const waiting = await ChatMessage.findOneAndDelete({ _id: id, sender: me, group: groupId }).lean<MessageDoc>();
  const fileId = waiting?.file?.id ?? (typeof body?.fileId === "string" && isValidObjectId(body.fileId) ? body.fileId : null);
  if (fileId) {
    const file = await ChatFile.findOneAndDelete({ _id: fileId, sender: me, group: groupId }).select("_id").lean();
    if (file) await deletePrivateFile(String(fileId));
  }
  // Утсандаа аль хэдийн авсан гишүүд дараа нь өөрсдөө арилгана — гишүүн бүрд нэг тэмдэглэл
  const others = group.members.map((m) => m.userId).filter((userId) => userId !== me);
  if (others.length) {
    await ChatDeletion.bulkWrite(
      others.map((recipient) => ({
        updateOne: {
          filter: { recipient, sender: me, messageId: id },
          update: { $setOnInsert: { recipient, sender: me, messageId: id, group: groupId } },
          upsert: true,
        },
      }))
    );
  }

  // Мэдэгдэлд энэ зурвасын текст харагдаж байж болно — сүүлийн зурвасаар дуугүй солино
  if (waiting) {
    after(async () => {
      const latest = await ChatMessage.findOne({ group: groupId }).sort({ _id: -1 }).lean<MessageDoc>();
      if (latest && String(latest._id) > id) return;
      const labelOf = new Map(group.members.map((m) => [m.userId, memberLabel(m)]));
      const text = latest ? `${labelOf.get(latest.sender) ?? ""}: ${previewText(latest)}` : "Зурвасаа устгасан";
      await notifyGroup(group, sender, text, true);
    });
  }

  return NextResponse.json({ ok: true });
}
