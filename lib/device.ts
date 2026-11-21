import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/lib/mongodb";
import Device from "@/lib/models/Device";

// Зарлан мэдээллийн аппыг суулгасан утсыг таних cookie. Хүний нөөц зөвшөөрсний дараа утас үүгээр л
// нэвтэрнэ — Clerk-ийн 7 хоногийн нэвтрэлт дуусахад дахин нэвтрэх шаардлагагүй. Гээсэн утсыг хүний нөөц
// хүчингүй болгоно.
const DEVICE_COOKIE = "zkh_device";
// Хөтчүүд cookie-г 400 хоногоос урт хадгалдаггүй; утсаа хэрэглэх бүрд дахин сунгана
const MAX_AGE = 400 * 24 * 60 * 60;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function newDeviceToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export async function setDeviceCookie(token: string) {
  (await cookies()).set(DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/** Энэ хөтөч/утсанд бүртгэгдсэн төхөөрөмж (ямар ч төлөвтэй) */
export async function getCurrentDevice() {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value;
  if (!token) return null;
  await connectToDatabase();
  const device = await Device.findOne({ tokenHash: hashToken(token) });
  return device ? { device, token } : null;
}

// Утас сүүлд хандсан цагийг (чатын «Идэвхтэй» төлөв) ингэж олон секундын нарийвчлалтай хадгална — апп нээлттэй
// үед утас хэдэн секунд тутам асуудаг тул өгөгдлийн сан руу хүсэлт бүрд бичихгүй
const SEEN_WRITE_MS = 10_000;

// --- Апп түгжээ (давхар түгжээ) ---
// Зөвшөөрөгдсөн утас ч гэсэн утасны өөрийн түгжээгээр (хээ, царай, PIN — WebAuthn, lib/app-lock.ts) баталгаажуулсны
// дараа л аппын API нээгдэнэ. Тайлсны тэмдэг нь httpOnly session cookie (утсанд — hash нь), аппыг ашиглахгүй
// UNLOCK_IDLE_MS болоход сервер дээр ч дуусна. Апп өөрөө далд ороход шууд түгжинэ (/api/app/lock/close).
const UNLOCK_COOKIE = "zkh_unlock";
const UNLOCK_IDLE_MS = 3 * 60_000;

export type LockState = "off" | "setup" | "locked" | "open";

type LockFields = { lock?: unknown; unlockHash?: string | null; unlockedUntil?: Date | null };

/** Зөвхөн хөгжүүлэлтийн туршилтад (next dev) түгжээг унтраах — production-д хэзээ ч үгүй */
const lockDisabled = () => process.env.NODE_ENV !== "production" && process.env.ZKH_APP_LOCK === "off";

/** Энэ утасны түгжээний төлөв: тохируулаагүй (setup), түгжээтэй (locked), тайлсан (open) */
export async function lockStateOf(device: LockFields): Promise<LockState> {
  if (lockDisabled()) return "off";
  if (!device.lock) return "setup";
  const token = (await cookies()).get(UNLOCK_COOKIE)?.value;
  const open =
    Boolean(token && device.unlockHash && hashToken(token) === device.unlockHash) &&
    Boolean(device.unlockedUntil && device.unlockedUntil.getTime() > Date.now());
  return open ? "open" : "locked";
}

/** Түгжээг тайлна: шинэ session cookie, сервер дээр hash + дуусах цаг */
export async function grantUnlock(deviceId: unknown) {
  const token = randomBytes(32).toString("base64url");
  await Device.updateOne(
    { _id: deviceId },
    { $set: { unlockHash: hashToken(token), unlockedUntil: new Date(Date.now() + UNLOCK_IDLE_MS) } }
  );
  // maxAge-гүй — хөтөч хаагдахад устна
  (await cookies()).set(UNLOCK_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

/** Шууд түгжинэ (апп далд орсон) */
export async function revokeUnlock(deviceId: unknown) {
  await Device.updateOne({ _id: deviceId }, { $unset: { unlockHash: 1, unlockedUntil: 1 } });
  (await cookies()).delete(UNLOCK_COOKIE);
}

/**
 * Хүний нөөц зөвшөөрсөн, түгжээг нь тайлсан утас — апп-ын API-д. Хэрэглэх бүрд сүүлд хандсан цаг, түгжээ
 * тайлсан хугацааг сунгаж, cookie-г сунгана. Түгжээтэй эсвэл тохируулаагүй бол null (API 403).
 */
export async function getApprovedDevice() {
  const current = await getCurrentDevice();
  if (current?.device.status !== "approved") return null;
  const { device, token } = current;
  const lock = await lockStateOf(device);
  if (lock === "setup" || lock === "locked") return null;
  const now = new Date();
  if (!device.lastSeenAt || now.getTime() - device.lastSeenAt.getTime() > SEEN_WRITE_MS) {
    device.lastSeenAt = now;
    await Device.updateOne(
      { _id: device._id },
      { $set: { lastSeenAt: now, ...(lock === "open" ? { unlockedUntil: new Date(now.getTime() + UNLOCK_IDLE_MS) } : {}) } }
    );
    await setDeviceCookie(token);
  }
  return device;
}

/** Апп хаагдсан/далд орсон — «Идэвхтэй» төлөвийг шууд унтраана (сүүлд хандсан цагийг идэвхтэй хугацаанаас өмнө болгоно) */
export async function markDeviceAway(onlineMs: number) {
  const current = await getCurrentDevice();
  if (current?.device.status !== "approved") return null;
  const now = Date.now();
  await Device.updateOne(
    { _id: current.device._id, lastSeenAt: { $gt: new Date(now - onlineMs) } },
    { $set: { lastSeenAt: new Date(now - onlineMs) } }
  );
  return current.device.userId as string;
}

/** Хүний нөөцөд харуулах товч нэр: "iPhone · Safari", "Android · Chrome" */
export function deviceLabel(userAgent: string | null) {
  const ua = userAgent ?? "";
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iPhone"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X/.test(ua)
          ? "Mac"
          : "Бусад";
  const browser = /EdgA?\//.test(ua)
    ? "Edge"
    : /SamsungBrowser/.test(ua)
      ? "Samsung"
      : /CriOS|Chrome\//.test(ua)
        ? "Chrome"
        : /FxiOS|Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "";
  return browser ? `${os} · ${browser}` : os;
}
