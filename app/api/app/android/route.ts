import { NextRequest, NextResponse, after } from "next/server";
import { getApprovedDevice } from "@/lib/device";
import Device from "@/lib/models/Device";
import { ALERT_LEVEL_MARK } from "@/lib/hr";
import { pushToDevices } from "@/lib/push";

const NOT_APPROVED = { error: "Энэ утсыг хүний нөөц зөвшөөрөөгүй байна" };
// Утсаа дуугүй болгож, дэлгэцээ унтраах хугацаа — ALARM_TEST_MS (туршилтад)
const DELAY_MS = Number(process.env.ALARM_TEST_MS) || 10_000;

const lastDrill = new Map<string, number>();

/** Энэ утсанд суусан Android аппын хувилбар — хүний нөөц хэний утас дуугүй үед ч дуугарахыг мэднэ. body: { version } */
export async function PUT(req: NextRequest) {
  const device = await getApprovedDevice();
  if (!device) return NextResponse.json(NOT_APPROVED, { status: 403 });
  const version = (await req.json().catch(() => null))?.version;
  if (!Number.isInteger(version) || version < 1 || version > 100_000) {
    return NextResponse.json({ error: "Хувилбар буруу" }, { status: 400 });
  }
  if (device.apk !== version) await Device.updateOne({ _id: device._id }, { $set: { apk: version } });
  return NextResponse.json({ ok: true });
}

/** Туршилтын улаан дохио: зөвхөн энэ хүний утсанд, жинхэнэ улаан мэдээлэлтэй ижил замаар очно */
export async function POST() {
  const device = await getApprovedDevice();
  if (!device) return NextResponse.json(NOT_APPROVED, { status: 403 });
  if (!device.push?.endpoint) return NextResponse.json({ error: "Эхлээд мэдэгдлээ асаана уу" }, { status: 400 });
  const userId: string = device.userId;
  const now = Date.now();
  if (now - (lastDrill.get(userId) ?? 0) < DELAY_MS * 2) {
    return NextResponse.json({ error: "Дохио замдаа явж байна. Түр хүлээнэ үү." }, { status: 429 });
  }
  lastDrill.set(userId, now);
  after(async () => {
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    // tag, гарчгийн тэмдэг нь улаан мэдээллийнхтэй ижил (lib/alerts.ts) — Android апп түүгээр нь таньдаг
    await pushToDevices(
      {
        title: `${ALERT_LEVEL_MARK.red} Туршилтын дохио`,
        body: "Жинхэнэ мэдээлэл биш. Утас тань дуугарсан бол бэлэн байна.",
        tag: "alert-test",
        level: "red",
      },
      [userId],
      undefined,
      { ttl: 60 }
    );
  });
  return NextResponse.json({ ok: true, seconds: Math.round(DELAY_MS / 1000) }, { status: 202 });
}
