import { Schema, model, models, type InferSchemaType } from "mongoose";

// «Хоёулангаас устгах»: илгээгч (sender) өөрийн зурвасыг устгасан. Хүлээн авагчийн утас дараагийн асуулгаар
// түүнийг өөрийн түүхээс арилгаад баталгаажуулмагц (POST /api/app/chat/removed) энэ тэмдэглэл устна. Зөвхөн id
// хадгална (зурвасын агуулга биш); хүлээн авагч жилийн турш аппаа нээгээгүй бол өөрөө устна.
// group — бүлгийн чатын зурвас байсан бол тэр бүлгийн id (гишүүн бүрд нэг тэмдэглэл).
const KEEP_DAYS = 365;
const ChatDeletionSchema = new Schema(
  {
    sender: { type: String, required: true },
    recipient: { type: String, required: true },
    messageId: { type: String, required: true },
    group: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ChatDeletionSchema.index({ recipient: 1, sender: 1, messageId: 1 }, { unique: true });
ChatDeletionSchema.index({ createdAt: 1 }, { expireAfterSeconds: KEEP_DAYS * 24 * 60 * 60 });

export type ChatDeletion = InferSchemaType<typeof ChatDeletionSchema>;

export default models.ChatDeletion || model("ChatDeletion", ChatDeletionSchema);
