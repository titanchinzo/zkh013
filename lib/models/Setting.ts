import { Schema, model, models } from "mongoose";

// Сайтаас өөрчилдөг ганц нэг тохиргоо (lib/settings.ts). _id — тохиргооны нэр.
const SettingSchema = new Schema(
  {
    _id: { type: String, required: true },
    value: { type: Schema.Types.Mixed },
    // Сүүлд өөрчилсөн хүний Clerk userId
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export default models.Setting || model("Setting", SettingSchema);
