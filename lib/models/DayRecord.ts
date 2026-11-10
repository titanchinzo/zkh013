import { Schema, model, models, type InferSchemaType } from "mongoose";
import { ATTENDANCE_STATUSES } from "@/lib/hr";

// Нэг өдрийн ирц, харуул, манаа. date нь Улаанбаатарын цагаар "YYYY-MM-DD".
const DayRecordSchema = new Schema(
  {
    date: { type: String, required: true, unique: true },
    guard: [{ type: Schema.Types.ObjectId, ref: "Personnel" }],
    watch: [{ type: Schema.Types.ObjectId, ref: "Personnel" }],
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

export default models.DayRecord || model("DayRecord", DayRecordSchema);
