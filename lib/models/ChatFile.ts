import { Schema, model, models, type InferSchemaType } from "mongoose";

// Чатаар илгээсэн файл. Агуулга нь серверийн хувийн хавтсанд (нийтэд нээгдэхгүй, нэр нь энэ баримтын _id) байна.
// uploading → ready (зурвас илгээгдсэн) → downloaded (хүлээн авагч татаж авмагц файл устна, илгээгч «Татаж авсан»
// гэж харах тул бичлэг нь хэсэг хугацаанд үлдэнэ). expiresAt өнгөрмөгц бичлэг өөрөө устна (TTL), диск дээрх файлыг
// lib/chat-files.ts цэвэрлэнэ.
const ChatFileSchema = new Schema(
  {
    sender: { type: String, required: true },
    recipient: { type: String, required: true },
    name: { type: String, required: true, maxlength: 200 },
    size: { type: Number, required: true },
    type: { type: String, default: "", maxlength: 120 },
    status: { type: String, enum: ["uploading", "ready", "downloaded"], default: "uploading" },
    downloadedAt: { type: Date },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

ChatFileSchema.index({ sender: 1, recipient: 1 });
ChatFileSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type ChatFile = InferSchemaType<typeof ChatFileSchema>;

export default models.ChatFile || model("ChatFile", ChatFileSchema);
