import { Schema, model, models, type InferSchemaType } from "mongoose";

const NewsSchema = new Schema(
  {
    title: { type: String, required: true },
    excerpt: { type: String, required: true },
    content: { type: String, required: true },
    imageUrl: { type: String, default: "" },
    // Мэдээний зургийн цомог (нүүр зургаас гадна)
    images: { type: [String], default: [] },
    // YouTube эсвэл Facebook-ийн видео/постын холбоос (мэдээн дотор embed хийж харуулна)
    mediaUrl: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "published", "rejected"],
      default: "pending",
    },
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Нэвтрээгүй хүнд API-аар харуулахгүй талбарууд (зохиогч, хянагчийн нэр/и-мэйл, Clerk ID)
export const STAFF_ONLY_FIELDS = "-authorId -authorName -reviewedBy -reviewedAt";

export type News = InferSchemaType<typeof NewsSchema>;

export default models.News || model("News", NewsSchema);
