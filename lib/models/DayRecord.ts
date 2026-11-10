import { Schema, model, models, type InferSchemaType } from "mongoose";
import { ATTENDANCE_STATUSES } from "@/lib/hr";

// Нэг өдрийн ирц ба харуул хоногийн манаа. date нь Улаанбаатарын цагаар "YYYY-MM-DD".
const DayRecordSchema = new Schema(
  {
    date: { type: String, required: true, unique: true },
    // Тэр өдөр харуул хоногийн манаанд гарах хүмүүс
    guard: [{ type: Schema.Types.ObjectId, ref: "Personnel" }],
    // Хуучин «хоногийн манаа» жагсаалт — одоо guard-тай нэг үүрэг; хадгалахад guard руу нийлж хоосорно
    watch: [{ type: Schema.Types.ObjectId, ref: "Personnel" }],
    // Манааны өдрийн «Тайван хоноорой» мэдэгдэл аль хэдийн очсон хүмүүс
    reminded: [{ type: Schema.Types.ObjectId, ref: "Personnel" }],
    attendance: [
      {
        _id: false,
        personnel: { type: Schema.Types.ObjectId, ref: "Personnel", required: true },
        status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
      },
    ],
  },
  { timestamps: true }
);

DayRecordSchema.index({ guard: 1, date: 1 });
DayRecordSchema.index({ watch: 1, date: 1 });

export type DayRecord = InferSchemaType<typeof DayRecordSchema>;

/** Тэр өдөр манаанд гарах хүмүүсийн id (хуучин watch-ийг оролцуулан) */
export function dutyIds(record: { guard?: unknown[]; watch?: unknown[] } | null | undefined): string[] {
  return [...new Set([...(record?.guard ?? []), ...(record?.watch ?? [])].map(String))];
}

export default models.DayRecord || model("DayRecord", DayRecordSchema);
