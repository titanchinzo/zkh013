import { Schema, model, models, type InferSchemaType } from "mongoose";
import { ALERT_LIMITS } from "@/lib/hr";

// Зарлан мэдээлэл — хүний нөөц илгээж, зөвшөөрөгдсөн утас бүрт мэдэгдэл очно. acks — "Хүлээн авлаа" дарсан хүмүүс.
const AlertSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: ALERT_LIMITS.title },
    body: { type: String, default: "", maxlength: ALERT_LIMITS.body },
    createdBy: { type: String, required: true },
    createdByName: { type: String, default: "" },
    acks: [{ _id: false, userId: { type: String, required: true }, at: { type: Date, required: true } }],
  },
  { timestamps: true }
);

AlertSchema.index({ createdAt: -1 });

export type Alert = InferSchemaType<typeof AlertSchema>;

export default models.Alert || model("Alert", AlertSchema);
