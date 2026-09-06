import { Schema, model, models, type InferSchemaType } from "mongoose";

const NewsSchema = new Schema(
  {
    title: { type: String, required: true },
    excerpt: { type: String, required: true },
    content: { type: String, required: true },
    imageUrl: { type: String, default: "" },
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

export type News = InferSchemaType<typeof NewsSchema>;

export default models.News || model("News", NewsSchema);
