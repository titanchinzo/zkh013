import { Schema, model, models, type InferSchemaType } from "mongoose";
import { CHAT_TTL_DAYS } from "@/lib/chat-shared";

// Хэн хэний зурвасыг хэзээ хүртэл уншсан: reader утсандаа хадгалаад серверт ack илгээх бүрд шинэчлэгдэнэ.
// «Уншаад 2 минутад устах» зурвасыг илгээгчийн утас уншсан цагаас нь тоолж устгахад хэрэглэнэ (сервер зурвасыг
// уншмагц устгадаг тул уншсан цаг өөр газар үлддэггүй).
const ChatReceiptSchema = new Schema({
  reader: { type: String, required: true },
  sender: { type: String, required: true },
  upTo: { type: String, required: true },
  at: { type: Date, required: true },
});

ChatReceiptSchema.index({ reader: 1, sender: 1 }, { unique: true });
ChatReceiptSchema.index({ at: 1 }, { expireAfterSeconds: CHAT_TTL_DAYS * 24 * 60 * 60 });

export type ChatReceipt = InferSchemaType<typeof ChatReceiptSchema>;

export default models.ChatReceipt || model("ChatReceipt", ChatReceiptSchema);
