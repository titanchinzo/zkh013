import "server-only";
import { isValidObjectId } from "mongoose";
import ChatFile from "@/lib/models/ChatFile";
import ChatMessage from "@/lib/models/ChatMessage";
import Personnel from "@/lib/models/Personnel";
import PersonnelGroup from "@/lib/models/PersonnelGroup";
import { personnelLabel } from "@/lib/hr";
import { isViewing } from "@/lib/chat";
import { fileExpiry } from "@/lib/chat-files";
import { groupChatId } from "@/lib/chat-shared";
import { ensureGroups } from "@/lib/personnel-groups";
import { pushToDevices } from "@/lib/push";
import { deletePrivateFile } from "@/lib/storage";

// Бүлгийн чат (сервер тал). Бүлэг бүр (PersonnelGroup) нэг чаттай; гишүүд нь тухайн бүлгийн идэвхтэй, аппаа
// бүртгүүлсэн алба хаагчид. Зурвас бүх гишүүн уншмагц (readBy), файл бүх гишүүн татмагц (downloadedBy) серверээс устна.

export type GroupMember = { userId: string; rank: string; name: string; photo: string };
export type ChatGroup = { id: string; name: string; members: GroupMember[] };

/** Бүлгийн гишүүд — идэвхтэй, аппаа бүртгүүлсэн алба хаагчид */
async function membersOf(name: string): Promise<GroupMember[]> {
  const people = await Personnel.find({ group: name, active: true, userId: { $type: "string" } })
    .select("userId rank name photo")
    .lean<{ userId: string; rank: string; name: string; photo?: string }[]>();
  return people.map((p) => ({ userId: p.userId, rank: p.rank, name: p.name, photo: p.photo ?? "" }));
}

/** Бүлэг (id-гаар) ба гишүүд — бүлэг байхгүй эсвэл me гишүүн биш бол null */
export async function loadGroup(groupId: string, me: string): Promise<ChatGroup | null> {
  if (!isValidObjectId(groupId)) return null;
  const doc = await PersonnelGroup.findById(groupId).select("name").lean<{ name: string }>();
  if (!doc) return null;
  const members = await membersOf(doc.name);
  return members.some((m) => m.userId === me) ? { id: groupId, name: doc.name, members } : null;
}

/** Бүлгийн чатын id (бүлгийн нэрээр) — бүлэггүй бол null. Дараалалд бүртгэгдээгүй бүлгийг бүртгэнэ. */
export async function groupOf(name: string | undefined | null): Promise<{ id: string; name: string } | null> {
  if (!name) return null;
  let doc = await PersonnelGroup.findOne({ name }).select("_id").lean<{ _id: unknown }>();
  if (!doc) {
    await ensureGroups([name]);
    doc = await PersonnelGroup.findOne({ name }).select("_id").lean<{ _id: unknown }>();
  }
  return doc ? { id: String(doc._id), name } : null;
}

export const memberLabel = (m: { rank: string; name: string }) => personnelLabel(m);

/** Хүн бүрийн уншаагүй зурвасын тоо (хүний чат + өгсөн бүлгийн чат) — аппын дүрс дээрх тоонд */
export async function unreadTotals(userIds: string[], groupId: string | null): Promise<Map<string, number>> {
  const totals = new Map(userIds.map((id) => [id, 0]));
  const direct = await ChatMessage.aggregate<{ _id: string; n: number }>([
    { $match: { recipient: { $in: userIds } } },
    { $group: { _id: "$recipient", n: { $sum: 1 } } },
  ]);
  for (const d of direct) totals.set(d._id, (totals.get(d._id) ?? 0) + d.n);
  if (groupId) {
    const pending = await ChatMessage.find({ group: groupId }).select("readBy").lean<{ readBy?: string[] }[]>();
    for (const id of userIds) {
      const n = pending.filter((m) => !m.readBy?.includes(id)).length;
      if (n) totals.set(id, (totals.get(id) ?? 0) + n);
    }
  }
  return totals;
}

/** Нэг хүний уншаагүй зурвасын нийт тоо (хүний чат + өөрийн бүлгийн чат) */
export async function unreadTotal(userId: string): Promise<number> {
  const person = await Personnel.findOne({ userId, active: true }).select("group").lean<{ group?: string }>();
  const group = await groupOf(person?.group);
  return (await unreadTotals([userId], group?.id ?? null)).get(userId) ?? 0;
}

/** Гишүүн бүлгийн файлыг татаж авсан (эсвэл татахаас татгалзсан). Бүх гишүүн татмагц серверээс устгана. */
export async function markGroupDownload(fileId: string, me: string) {
  const file = await ChatFile.findOneAndUpdate(
    { _id: fileId, status: "ready" },
    { $addToSet: { downloadedBy: me } },
    { returnDocument: "after" }
  )
    .select("sender group downloadedBy")
    .lean<{ sender: string; group?: string; downloadedBy?: string[] }>();
  if (!file?.group) return;
  const doc = await PersonnelGroup.findById(file.group).select("name").lean<{ name: string }>();
  const members = doc ? await membersOf(doc.name) : [];
  const got = new Set([file.sender, ...(file.downloadedBy ?? [])]);
  if (members.every((m) => got.has(m.userId))) {
    await ChatFile.updateOne(
      { _id: fileId, status: "ready" },
      { $set: { status: "downloaded", downloadedAt: new Date(), expiresAt: fileExpiry.downloaded() } }
    );
    await deletePrivateFile(fileId);
  }
}

/**
 * Бүлгийн гишүүдийн утсанд мэдэгдэл — илгээгч болон тэр чатыг нээлттэй харж буй хүнээс бусдад. Аппын дүрс дээрх тоо
 * хүн бүрд өөр. silent — өмнөх мэдэгдлийг дуугүй шинэчилнэ (зурвасаа устгасан үед).
 */
export async function notifyGroup(
  group: ChatGroup,
  sender: { userId: string; photo?: string },
  text: string,
  silent = false
) {
  const chatId = groupChatId(group.id);
  const targets = group.members.map((m) => m.userId).filter((id) => id !== sender.userId && !isViewing(id, chatId));
  if (!targets.length) return;
  const badges = await unreadTotals(targets, group.id);
  await pushToDevices(
    {
      kind: "chat",
      title: group.name,
      body: text.length > 140 ? `${text.slice(0, 140)}…` : text,
      url: `/app?chat=${encodeURIComponent(chatId)}`,
      tag: `chat-${chatId}`,
      icon: sender.photo || undefined,
      ...(silent ? { silent: true } : {}),
    },
    targets,
    badges
  );
}
