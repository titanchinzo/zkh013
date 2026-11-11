import { Schema, model, models, type InferSchemaType } from "mongoose";
import { ALERT_LIMITS } from "@/lib/hr";

// Зарлан мэдээлэл — хүний нөөц илгээж, зөвшөөрөгдсөн утас бүрт мэдэгдэл очно. acks — "Хүлээн авлаа" дарсан хүмүүс.
// Хугацаатай: эхлэх цаг болоход утсанд мэдэгдэл очиж харагдана, дуусах цаг өнгөрмөгц MongoDB өөрөө устгана (TTL).
const AlertSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: ALERT_LIMITS.title },
    body: { type: String, default: "", maxlength: ALERT_LIMITS.body },
    createdBy: { type: String, required: true },
    createdByName: { type: String, default: "" },
    // Хугацаатай болохоос (2026-11-11) өмнө илгээсэн мэдээлэлд startsAt/endsAt байхгүй — үүсгэсэн цагаасаа
    // хугацаагүй харагдана. Default өгөхгүй: Mongoose хуучин баримтыг уншихад default-ыг нь бөглөчихнө.
    startsAt: { type: Date },
    endsAt: { type: Date },
    // Утсанд мэдэгдэл илгээсэн цаг — товлосон мэдээлэлд эхлэх цаг нь болтол байхгүй
    notifiedAt: { type: Date },
    editedAt: { type: Date },
    acks: [{ _id: false, userId: { type: String, required: true }, at: { type: Date, required: true } }],
  },
  { timestamps: true }
);

AlertSchema.index({ createdAt: -1 });
// Дуусах цаг өнгөрмөгц (MongoDB минут тутам шалгана) хүлээн авсан тэмдэглэлийн хамт устна
AlertSchema.index({ endsAt: 1 }, { expireAfterSeconds: 0 });

export type Alert = InferSchemaType<typeof AlertSchema>;

export default models.Alert || model("Alert", AlertSchema);
