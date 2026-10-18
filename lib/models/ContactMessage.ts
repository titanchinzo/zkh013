import { Schema, model, models, type InferSchemaType } from "mongoose";
import { CONTACT_LIMITS } from "@/lib/contact";

const ContactMessageSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: CONTACT_LIMITS.name },
    email: { type: String, required: true, maxlength: CONTACT_LIMITS.email },
    subject: { type: String, required: true, maxlength: CONTACT_LIMITS.subject },
    message: { type: String, required: true, maxlength: CONTACT_LIMITS.message },
    read: { type: Boolean, default: false },
    // Илгээгчийн IP-ийн hash — нэг хүнээс ирэх зурвасын тоог хязгаарлахад
    sender: { type: String, default: "" },
  },
  { timestamps: true }
);

ContactMessageSchema.index({ sender: 1, createdAt: -1 });

export type ContactMessage = InferSchemaType<typeof ContactMessageSchema>;

export default models.ContactMessage || model("ContactMessage", ContactMessageSchema);
