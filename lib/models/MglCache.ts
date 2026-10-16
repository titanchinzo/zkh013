import { Schema, model, models } from "mongoose";

// Өөрчлөгддөг бичвэрийн (мэдээ, сургалтын материал) монгол бичгийн хөрвүүлгийн кэш.
// _id нь кирилл мөрийн hash — нэг мөрийг Kimo-оор ганц л удаа хөрвүүлнэ.
const MglCacheSchema = new Schema(
  {
    _id: { type: String, required: true },
    source: { type: String, required: true },
    mgl: { type: String, required: true },
  },
  { timestamps: true }
);

export default models.MglCache || model("MglCache", MglCacheSchema);
