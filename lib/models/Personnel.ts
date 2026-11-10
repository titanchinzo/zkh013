import { Schema, model, models, type InferSchemaType } from "mongoose";
import { PERSONNEL_LIMITS } from "@/lib/hr";

// Алба хаагч — хүний нөөц бүртгэнэ эсвэл урилгаар орж ирсэн хүн өөрөө үүсгэнэ. Утсаа бүртгүүлсэн бол
// Clerk хэрэглэгчтэй (userId) холбогдоно.
const PersonnelSchema = new Schema(
  {
    rank: { type: String, default: "", maxlength: PERSONNEL_LIMITS.rank },
    name: { type: String, required: true, maxlength: PERSONNEL_LIMITS.name },
    position: { type: String, default: "", maxlength: PERSONNEL_LIMITS.position },
    // 8 оронтой утасны дугаар — шинээр бүртгэхэд заавал
    phone: { type: String, default: "" },
    // Профайл зураг (/uploads/avatars/...)
    photo: { type: String, default: "" },
    userId: { type: String },
    // Хүний нөөцөөс олгосон «Бүртгэх эрх» — доод хүмүүсээ и-мэйлээр урьж бүртгэнэ
    canRegister: { type: Boolean, default: false },
    // Урьсан хүний Clerk userId (хүний нөөц, админ эсвэл бүртгэх эрхтэй дарга)
    invitedBy: { type: String },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

PersonnelSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: "string" } } });
PersonnelSchema.index({ invitedBy: 1 });

export type Personnel = InferSchemaType<typeof PersonnelSchema>;

export default models.Personnel || model("Personnel", PersonnelSchema);
