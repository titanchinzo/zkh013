import { Schema, model, models, type InferSchemaType } from "mongoose";

const TrainingMaterialSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    // "file": Vercel Blob-д upload хийсэн файл, "link": гадны холбоос
    kind: { type: String, enum: ["file", "link"], required: true },
    url: { type: String, required: true },
    fileName: { type: String, default: "" },
    fileExt: { type: String, default: "" },
    fileSize: { type: Number, default: 0 },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

export type TrainingMaterialDoc = InferSchemaType<typeof TrainingMaterialSchema>;

export default models.TrainingMaterial || model("TrainingMaterial", TrainingMaterialSchema);
