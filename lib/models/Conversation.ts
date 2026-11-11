import { Schema, model, models, type InferSchemaType } from "mongoose";

// Утсан дээрх аппын хоёр хүний чат. Гишүүдийг Clerk userId-аар хадгална; key — эрэмбэлсэн хоёр userId,
// нэг хосын хооронд ганц л чат байна. unread/readAt — гишүүн бүрийн уншаагүй тоо, хамгийн сүүлд уншсан цаг.
const ConversationSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    members: { type: [String], required: true },
    lastMessage: {
      type: new Schema({ text: String, sender: String, at: Date }, { _id: false }),
      default: undefined,
    },
    unread: { type: Map, of: Number },
    readAt: { type: Map, of: Date },
  },
  { timestamps: true }
);

ConversationSchema.index({ members: 1, "lastMessage.at": -1 });

export type Conversation = InferSchemaType<typeof ConversationSchema>;

export default models.Conversation || model("Conversation", ConversationSchema);
