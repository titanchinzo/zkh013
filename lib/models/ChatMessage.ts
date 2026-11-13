import { Schema, model, models, type InferSchemaType } from "mongoose";
import { CHAT_LIMITS, CHAT_TTL_DAYS } from "@/lib/chat-shared";

// Хүлээн авагчид хараахан хүрээгүй (уншаагүй) чатын зурвас. Хүлээн авагчийн утас уншиж өөртөө хадгалмагц серверээс
// устгана — чатын түүх зөвхөн хоёр хүний утсанд үлдэнэ. Удаан нээгээгүй зурвас CHAT_TTL_DAYS хоногийн дараа өөрөө устна.
// file — хавсаргасан файл (ChatFile; татаж авмагц серверээс устна). ephemeral — уншсанаас хойш 2 минутад хоёр утаснаас
// устах зурвас.
// Бүлгийн чатын зурвас: recipient-гүй, group (PersonnelGroup _id) + readBy — уншсан гишүүд (илгээгч эхнээсээ орно).
// Бүлгийн бүх идэвхтэй, апптай гишүүн уншмагц серверээс устна.
const ChatMessageSchema = new Schema(
  {
    sender: { type: String, required: true },
    recipient: { type: String },
    group: { type: String },
    readBy: { type: [String], default: undefined },
    text: { type: String, default: "", maxlength: CHAT_LIMITS.text },
    file: {
      type: new Schema(
        { id: { type: String, required: true }, name: String, size: Number, type: { type: String } },
        { _id: false }
      ),
      default: undefined,
    },
    ephemeral: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Тухайн хүнд ирсэн, тухайн хүнээс ирсэн зурвасууд — үүссэн дарааллаар
ChatMessageSchema.index({ recipient: 1, sender: 1, _id: 1 });
// Бүлгийн чатын зурвасууд — үүссэн дарааллаар
ChatMessageSchema.index({ group: 1, _id: 1 });
ChatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: CHAT_TTL_DAYS * 24 * 60 * 60 });

export type ChatMessage = InferSchemaType<typeof ChatMessageSchema>;

export default models.ChatMessage || model("ChatMessage", ChatMessageSchema);
