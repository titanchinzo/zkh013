import { Schema, model, models, type InferSchemaType } from "mongoose";
import { PERSONNEL_LIMITS } from "@/lib/hr";

// Алба хаагч — хүний нөөц бүртгэнэ. Утсаа бүртгүүлсэн бол Clerk хэрэглэгчтэй (userId) холбогдоно.
const PersonnelSchema = new Schema(
  {
    rank: { type: String, default: "", maxlength: PERSONNEL_LIMITS.rank },
    name: { type: String, required: true, maxlength: PERSONNEL_LIMITS.name },
    position: { type: String, default: "", maxlength: PERSONNEL_LIMITS.position },
    userId: { type: String },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

PersonnelSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: "string" } } });

export type Personnel = InferSchemaType<typeof PersonnelSchema>;

export default models.Personnel || model("Personnel", PersonnelSchema);
