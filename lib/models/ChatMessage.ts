import { Schema, model, models, type InferSchemaType } from "mongoose";
import { CHAT_LIMITS, CHAT_TTL_DAYS } from "@/lib/chat-shared";

// Хүлээн авагчид хараахан хүрээгүй (уншаагүй) чатын зурвас. Хүлээн авагчийн утас уншиж өөртөө хадгалмагц серверээс
// устгана — чатын түүх зөвхөн хоёр хүний утсанд үлдэнэ. Удаан нээгээгүй зурвас CHAT_TTL_DAYS хоногийн дараа өөрөө устна.
const ChatMessageSchema = new Schema(
  {
    sender: { type: String, required: true },
    recipient: { type: String, required: true },
    text: { type: String, required: true, maxlength: CHAT_LIMITS.text },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Тухайн хүнд ирсэн, тухайн хүнээс ирсэн зурвасууд — үүссэн дарааллаар
ChatMessageSchema.index({ recipient: 1, sender: 1, _id: 1 });
ChatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: CHAT_TTL_DAYS * 24 * 60 * 60 });

export type ChatMessage = InferSchemaType<typeof ChatMessageSchema>;

export default models.ChatMessage || model("ChatMessage", ChatMessageSchema);
