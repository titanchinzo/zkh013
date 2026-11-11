import { Schema, model, models, type InferSchemaType } from "mongoose";
import { CHAT_LIMITS } from "@/lib/chat-shared";

// Чатын зурвас. _id-ийн дарааллаар (үүссэн цагаар) эрэмбэлж, хуудаслана.
const ChatMessageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, required: true },
    sender: { type: String, required: true },
    text: { type: String, required: true, maxlength: CHAT_LIMITS.text },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ChatMessageSchema.index({ conversation: 1, _id: -1 });
// Нэг хүн минутад хэт олон зурвас илгээхийг хязгаарлахад
ChatMessageSchema.index({ sender: 1, createdAt: -1 });

export type ChatMessage = InferSchemaType<typeof ChatMessageSchema>;

export default models.ChatMessage || model("ChatMessage", ChatMessageSchema);
