import { Schema, model, models, type InferSchemaType } from "mongoose";
import { PERSONNEL_LIMITS } from "@/lib/hr";

// Зарлан мэдээллийн апп суулгасан утас. Хүн бүр нэг л зөвшөөрөгдсөн утастай — шинэ утас, гээсэн утсыг
// хүний нөөц шийднэ. Утсыг httpOnly cookie-д хадгалсан нууц тэмдэгтээр (энд зөвхөн hash нь) таньна.
const DeviceSchema = new Schema(
  {
    userId: { type: String, required: true },
    email: { type: String, default: "" },
    // Хүсэлт илгээхдээ бичсэн мэдээлэл — хүний нөөц алба хаагчтай тулгаж зөвшөөрнө
    rank: { type: String, default: "", maxlength: PERSONNEL_LIMITS.rank },
    name: { type: String, required: true, maxlength: PERSONNEL_LIMITS.name },
    position: { type: String, default: "", maxlength: PERSONNEL_LIMITS.position },
    phone: { type: String, default: "" },
    label: { type: String, default: "" },
    tokenHash: { type: String, required: true, unique: true },
    status: { type: String, enum: ["pending", "approved", "rejected", "revoked"], default: "pending" },
    push: {
      type: new Schema(
        { endpoint: { type: String, required: true }, keys: { p256dh: String, auth: String } },
        { _id: false }
      ),
      default: undefined,
    },
    decidedBy: { type: String },
    decidedAt: { type: Date },
    lastSeenAt: { type: Date },
    // Апп түгжээ (WebAuthn): утасны өөрийн түгжээгээр (хурууны хээ, царай, PIN) аппаа нээнэ. Зөвхөн нийтийн
    // түлхүүрийг хадгална — нууц түлхүүр утаснаас гардаггүй. Тохируулаагүй утас аппаа ашиглахгүй (lib/device.ts).
    lock: {
      type: new Schema(
        {
          credentialId: { type: String, required: true },
          publicKey: { type: Buffer, required: true },
          counter: { type: Number, default: 0 },
          transports: { type: [String], default: [] },
          createdAt: { type: Date, default: Date.now },
        },
        { _id: false }
      ),
      default: undefined,
    },
    // Нэг удаагийн WebAuthn challenge (тохируулах эсвэл тайлах үед)
    lockChallenge: { type: String },
    lockChallengeAt: { type: Date },
    // Түгжээ тайлсан хугацаа: httpOnly cookie-ийн hash, ашиглахгүй бол дуусах цаг
    unlockHash: { type: String },
    unlockedUntil: { type: Date },
  },
  { timestamps: true }
);

DeviceSchema.index({ userId: 1, status: 1 });
DeviceSchema.index({ status: 1, createdAt: -1 });

export type Device = InferSchemaType<typeof DeviceSchema>;

export default models.Device || model("Device", DeviceSchema);
