import { Schema, model, models, type InferSchemaType } from "mongoose";
import { PERSONNEL_LIMITS } from "@/lib/hr";

// Алба хаагчдын бүлэг (алба, тасаг, рот…) ба жагсаалт дахь дараалал — захирагчаас эхлэн ангийн бүтцээр.
// Алба хаагч бүлгээ нэрээр нь (Personnel.group) заана.
const PersonnelGroupSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, maxlength: PERSONNEL_LIMITS.group },
    order: { type: Number, default: 0 },
    // Энэ бүлгийнхэн аппын утасны жагсаалтад нууцалсан болон «Шаардлагатай үед» дугааруудыг харна. Тохируулаагүй
    // бол «Захирагч…» бүлэг л.
    seesAll: { type: Boolean },
    // Энэ бүлгийнхний дугаар нууц — зөвхөн «Бүх утас харна» эрхтэй хүмүүс болон бүлгийнхэн нь харна. Тохируулаагүй бол
    // «Захирагч…» бүлэг л.
    hidesPhones: { type: Boolean },
  },
  { timestamps: true }
);

export type PersonnelGroup = InferSchemaType<typeof PersonnelGroupSchema>;

export default models.PersonnelGroup || model("PersonnelGroup", PersonnelGroupSchema);
