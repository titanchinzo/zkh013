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

/** Хүний нөөц зөвшөөрсөн утас — апп-ын API-д. Хэрэглэх бүрд сүүлд хандсан цагийг шинэчилж, cookie-г сунгана. */
export async function getApprovedDevice() {
  const current = await getCurrentDevice();
  if (current?.device.status !== "approved") return null;
  const { device, token } = current;
  const now = new Date();
  if (!device.lastSeenAt || now.getTime() - device.lastSeenAt.getTime() > SEEN_WRITE_MS) {
    device.lastSeenAt = now;
    await Device.updateOne({ _id: device._id }, { $set: { lastSeenAt: now } });
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
