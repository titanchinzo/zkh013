import "server-only";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";

/**
 * 2026-11-11: чатын түүхийг серверт хадгалахаа больсон (зурвас уншигдмагц устна). Өмнөх хувилбарын үлдэгдлийг
 * цэвэрлэнэ: уншсан зурвасыг устгаж, уншаагүйг хүлээн авагчид нь хүргэхээр үлдээж, conversations цуглуулгыг устгана.
 * Сервер асах бүрд шалгана; цэвэрлэсний дараа юу ч хийхгүй.
 */
export async function migrateLegacyChat() {
  await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) return;
  const existing = await db.listCollections({ name: "conversations" }, { nameOnly: true }).toArray();
  if (!existing.length) return;

  const conversations = db.collection("conversations");
  const messages = db.collection("chatmessages");
  let removed = 0;
  let kept = 0;
  for await (const c of conversations.find({}, { projection: { members: 1, readAt: 1 } })) {
    const members: string[] = c.members ?? [];
    const legacy = await messages.find({ conversation: c._id }, { projection: { sender: 1, createdAt: 1 } }).toArray();
    for (const m of legacy) {
      const recipient = members.find((u) => u !== m.sender);
      const readAt: Date | undefined = recipient ? c.readAt?.[recipient] : undefined;
      if (!recipient || (readAt && readAt >= m.createdAt)) {
        await messages.deleteOne({ _id: m._id });
        removed++;
      } else {
        await messages.updateOne({ _id: m._id }, { $set: { recipient }, $unset: { conversation: "" } });
        kept++;
      }
    }
  }
  removed += (await messages.deleteMany({ recipient: { $exists: false } })).deletedCount;
  for (const index of ["conversation_1__id_-1", "sender_1_createdAt_-1"]) {
    await messages.dropIndex(index).catch(() => {});
  }
  await conversations.drop();
  console.log(`[chat] хуучин чатыг цэвэрлэв: уншсан ${removed} зурвас устгав, уншаагүй ${kept} зурвас үлдээв`);
}
