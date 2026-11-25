import "server-only";
import { connectToDatabase } from "@/lib/mongodb";
import Setting from "@/lib/models/Setting";

const BYPASS_NUMBERS = "bypassNumbers";

/** Яаралтай үед залгах дугаарууд (iPhone-ы Emergency Bypass) — хүний нөөц тохируулаагүй бол хоосон */
export async function getBypassNumbers(): Promise<string[]> {
  await connectToDatabase();
  const doc = await Setting.findById(BYPASS_NUMBERS).lean<{ value?: unknown }>();
  return Array.isArray(doc?.value) ? doc.value.filter((n): n is string => typeof n === "string") : [];
}

export async function setBypassNumbers(numbers: string[], userId: string) {
  await connectToDatabase();
  await Setting.updateOne({ _id: BYPASS_NUMBERS }, { $set: { value: numbers, updatedBy: userId } }, { upsert: true });
}
