import { Schema, model, models, type InferSchemaType } from "mongoose";

// Удирдлагатай (захирагч, орлогч нар г.м — «Дугаар нууц») өмнө чатаар бичилцсэн хоёр хүн. Удирдлагад бусад түрүүлж
// бичихгүй; харин энд бүртгэгдсэн хос (удирдлага өөрөө түрүүлж бичсэн, эсвэл энэ хязгаарлалтаас өмнө бичилцсэн)
// чатаа үргэлжлүүлнэ. Зөвхөн хоёр хүний id (a < b) — зурвасын агуулга, цаг хадгалахгүй. lib/chat-access.ts.
const ChatPermitSchema = new Schema({
  a: { type: String, required: true },
  b: { type: String, required: true },
});

ChatPermitSchema.index({ a: 1, b: 1 }, { unique: true });
ChatPermitSchema.index({ b: 1 });

export type ChatPermit = InferSchemaType<typeof ChatPermitSchema>;

export default models.ChatPermit || model("ChatPermit", ChatPermitSchema);
