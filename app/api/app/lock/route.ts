import { NextRequest, NextResponse } from "next/server";
import Device from "@/lib/models/Device";
import Personnel from "@/lib/models/Personnel";
import { getCurrentDevice, grantUnlock, lockStateOf } from "@/lib/device";
import { CHALLENGE_TTL_MS, setupOptions, unlockOptions, verifySetup, verifyUnlock } from "@/lib/app-lock";
import { personnelLabel } from "@/lib/hr";

// Апп түгжээ: утасны өөрийн түгжээгээр (хээ, царай, PIN) анх тохируулах, тайлах. Түгжээтэй утас бусад аппын API-г
// ашиглахгүй тул энд зөвхөн хүний нөөц зөвшөөрсөн эсэхийг шалгана.

const NOT_APPROVED = { error: "Энэ утсыг хүний нөөц зөвшөөрөөгүй байна" };
const FAILED = { error: "Баталгаажуулж чадсангүй. Дахин оролдоно уу." };

type Lock = { credentialId: string; publicKey: Buffer; counter: number; transports?: string[] };

async function approvedDevice() {
  const current = await getCurrentDevice();
  return current?.device.status === "approved" ? current.device : null;
}

const storedLock = (lock: Lock): Lock => ({
  credentialId: lock.credentialId,
  publicKey: Buffer.from(lock.publicKey),
  counter: lock.counter ?? 0,
  transports: [...(lock.transports ?? [])],
});

/** GET → { mode: "setup" | "unlock", options } — шинэ нэг удаагийн challenge-тэй (өмнөхийг орлоно) */
export async function GET(req: NextRequest) {
  const device = await approvedDevice();
  if (!device) return NextResponse.json(NOT_APPROVED, { status: 403 });
  if ((await lockStateOf(device)) === "off") return NextResponse.json({ mode: "off" });

  let mode: "setup" | "unlock";
  let options: { challenge: string };
  if (!device.lock) {
    const person = await Personnel.findOne({ userId: device.userId }).select("rank name").lean<{ rank: string; name: string }>();
    mode = "setup";
    options = await setupOptions(req, String(device._id), person ? personnelLabel(person) : device.name);
  } else {
    mode = "unlock";
    options = await unlockOptions(req, storedLock(device.lock));
  }
  await Device.updateOne({ _id: device._id }, { $set: { lockChallenge: options.challenge, lockChallengeAt: new Date() } });
  return NextResponse.json({ mode, options });
}

/**
 * POST { response } — утасны түгжээгээр баталгаажуулсан хариу. Анх бол түлхүүрийг хадгална, дараа нь тэр
 * түлхүүрээр шалгана. Зөв бол аппын түгжээг тайлна.
 */
export async function POST(req: NextRequest) {
  const device = await approvedDevice();
  if (!device) return NextResponse.json(NOT_APPROVED, { status: 403 });
  const response = (await req.json().catch(() => null))?.response;
  if (!response || typeof response !== "object") return NextResponse.json(FAILED, { status: 400 });

  // Challenge нэг л удаа ашиглагдана — шалгахаас өмнө устгана
  const challenge: string | undefined = device.lockChallenge ?? undefined;
  const issuedAt: Date | undefined = device.lockChallengeAt ?? undefined;
  const claimed = challenge
    ? await Device.updateOne({ _id: device._id, lockChallenge: challenge }, { $unset: { lockChallenge: 1, lockChallengeAt: 1 } })
    : null;
  if (!challenge || !claimed?.modifiedCount || !issuedAt || Date.now() - issuedAt.getTime() > CHALLENGE_TTL_MS) {
    return NextResponse.json({ error: "Хугацаа дууссан. Дахин оролдоно уу." }, { status: 400 });
  }

  try {
    if (!device.lock) {
      const lock = await verifySetup(req, response, challenge);
      if (!lock) return NextResponse.json(FAILED, { status: 400 });
      // Зэрэг хоёр удаа тохируулбал эхнийх нь л үлдэнэ
      const saved = await Device.updateOne({ _id: device._id, lock: { $exists: false } }, { $set: { lock } });
      if (!saved.modifiedCount) return NextResponse.json(FAILED, { status: 409 });
    } else {
      const counter = await verifyUnlock(req, response, challenge, storedLock(device.lock));
      if (counter === null) return NextResponse.json(FAILED, { status: 400 });
      await Device.updateOne({ _id: device._id }, { $set: { "lock.counter": counter } });
    }
  } catch (err) {
    console.warn("[app-lock] баталгаажуулалт амжилтгүй:", err instanceof Error ? err.message : err);
    return NextResponse.json(FAILED, { status: 400 });
  }

  await grantUnlock(device._id);
  return NextResponse.json({ ok: true });
}
