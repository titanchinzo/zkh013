import { Schema, model, models, type InferSchemaType } from "mongoose";
import { AHMAD_LIMITS } from "@/lib/ahmad";

// «Ахмад» хэсгийн пост — «Ахмад» эрхтэй хүний түүхэн зураг, дурсамж. Хянагч зөвшөөрсний дараа нийтэд гарна.
const AhmadPostSchema = new Schema(
  {
    author: { type: String, required: true }, // Clerk userId
    authorName: { type: String, required: true, maxlength: 160 },
    text: { type: String, default: "", maxlength: AHMAD_LIMITS.text },
    // Зураг авсан он (заавал биш)
    year: { type: Number },
    images: { type: [String], default: [] },
    status: { type: String, enum: ["pending", "published", "rejected"], default: "pending" },
    reviewedBy: { type: String },
    reviewedAt: { type: Date },
    publishedAt: { type: Date },
    // Зүрх дарсан хүмүүсийн Clerk userId — нэг хүн нэг удаа
    hearts: { type: [String], default: [] },
  },
  { timestamps: true }
);

AhmadPostSchema.index({ status: 1, publishedAt: -1 });
AhmadPostSchema.index({ author: 1, createdAt: -1 });

export type AhmadPost = InferSchemaType<typeof AhmadPostSchema>;

export default models.AhmadPost || model("AhmadPost", AhmadPostSchema);
