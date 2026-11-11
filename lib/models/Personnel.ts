import { Schema, model, models, type InferSchemaType } from "mongoose";
import { PERSONNEL_LIMITS } from "@/lib/hr";

// Алба хаагч — хүний нөөц бүртгэнэ эсвэл урилгаар орж ирсэн хүн өөрөө үүсгэнэ. Утсаа бүртгүүлсэн бол
// Clerk хэрэглэгчтэй (userId) холбогдоно.
const PersonnelSchema = new Schema(
  {
    rank: { type: String, default: "", maxlength: PERSONNEL_LIMITS.rank },
    name: { type: String, required: true, maxlength: PERSONNEL_LIMITS.name },
    position: { type: String, default: "", maxlength: PERSONNEL_LIMITS.position },
    // 8 оронтой утасны дугаар — шинээр бүртгэхэд заавал (жагсаалтаас оруулахад дугааргүй байж болно)
    phone: { type: String, default: "" },
    // Өөрийн бусад дугаар — аппад бүртгүүлэхэд аль нэгээр нь танигдана
    extraPhones: { type: [String], default: [] },
    // «Шаардлагатай үед» холбогдох дугаар (гэр бүл г.м) — зөвхөн хүний нөөцөд
    emergencyPhone: { type: String, default: "" },
    // Ангийн бүтцийн бүлэг (алба, тасаг, рот…) — дараалал нь PersonnelGroup-д
    group: { type: String, default: "", maxlength: PERSONNEL_LIMITS.group },
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
PersonnelSchema.index({ phone: 1 });
PersonnelSchema.index({ extraPhones: 1 });

export type Personnel = InferSchemaType<typeof PersonnelSchema>;

export default models.Personnel || model("Personnel", PersonnelSchema);
