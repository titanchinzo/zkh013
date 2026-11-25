import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import Device from "@/lib/models/Device";
import Personnel from "@/lib/models/Personnel";
import { getActor } from "@/lib/actor";
import { isHrRole } from "@/lib/roles";
import { phoneKind } from "@/lib/bypass";
import { getBypassNumbers } from "@/lib/settings";

/**
 * Хүний нөөц iPhone-той хүн рүү (утсаа дуугүй болгосон үед нь) залгаж шалгасан дүн. body: { result }
 * - "rang" — дуугарсан: Emergency Bypass ажиллаж байна.
 * - "silent" — дуугараагүй: тэмдэглэл арилж, тэр хүнд заавар дахин гарна.
 * Эсвэл энэ утасны эзэнд улаан дохио илгээх эсэх (ямар ч утас): body: { alarm }
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor || !isHrRole(actor.role)) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const result = body?.result;
  const alarm = typeof body?.alarm === "boolean" ? body.alarm : null;
  if (alarm === null && result !== "rang" && result !== "silent") return NextResponse.json({ error: "Буруу үйлдэл" }, { status: 400 });
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Утас олдсонгүй" }, { status: 404 });

  await connectToDatabase();
  const device = await Device.findOne({ _id: id, status: "approved" })
    .select("userId label bypass")
    .lean<{ userId: string; label: string; bypass?: { at?: Date } }>();
  if (!device) return NextResponse.json({ error: "Утас олдсонгүй" }, { status: 404 });
  if (alarm !== null) {
    const { matchedCount } = await Personnel.updateOne({ userId: device.userId }, { $set: { noAlarm: !alarm } });
    return matchedCount
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "Алба хаагчийн бүртгэлтэй холбогдоогүй утас" }, { status: 400 });
  }
  if (phoneKind(device.label) !== "iphone") return NextResponse.json({ error: "Утас олдсонгүй" }, { status: 404 });

  if (result === "silent") {
    await Device.updateOne({ _id: id }, { $unset: { bypass: 1 } });
    return NextResponse.json({ ok: true });
  }
  const numbers = await getBypassNumbers();
  if (numbers.length === 0) return NextResponse.json({ error: "Эхлээд залгах дугаараа оруулна уу" }, { status: 400 });
  const now = new Date();
  // Өөрөө тэмдэглээгүй байсан ч дуугарсан бол тохируулсан гэсэн үг
  await Device.updateOne(
    { _id: id },
    { $set: { bypass: { numbers, at: device.bypass?.at ?? now, testedAt: now, testedBy: actor.userId } } }
  );
  return NextResponse.json({ ok: true });
}
