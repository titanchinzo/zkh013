import { Schema, model, models, type InferSchemaType } from "mongoose";
import { PERSONNEL_LIMITS } from "@/lib/hr";

// Алба хаагчдын бүлэг (алба, тасаг, рот…) ба жагсаалт дахь дараалал — захирагчаас эхлэн ангийн бүтцээр.
// Алба хаагч бүлгээ нэрээр нь (Personnel.group) заана.
const PersonnelGroupSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, maxlength: PERSONNEL_LIMITS.group },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type PersonnelGroup = InferSchemaType<typeof PersonnelGroupSchema>;

export default models.PersonnelGroup || model("PersonnelGroup", PersonnelGroupSchema);
