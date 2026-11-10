import "server-only";
import webpush, { WebPushError } from "web-push";
import Device from "@/lib/models/Device";
import { SITE_URL } from "@/lib/site";

// Утас руу мэдэгдэл (Web Push). Хөтчийн өөрийн push үйлчилгээгээр (Google, Apple, Mozilla) үнэгүй очно.
// VAPID түлхүүрийг .env.local-д: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (npx web-push generate-vapid-keys).

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

let configured = false;

export function vapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

function configure() {
  const publicKey = vapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  if (!configured) {
    // Push үйлчилгээ илгээгчтэй холбогдох хаяг — https: эсвэл mailto: байх ёстой (local-ийн http биш)
    const subject = process.env.VAPID_SUBJECT || (SITE_URL.startsWith("https://") ? SITE_URL : "https://unit013.mn");
    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
    } catch (err) {
      console.error("[push] VAPID тохиргоо буруу:", err);
      return false;
    }
    configured = true;
  }
  return true;
}

/**
 * Зөвшөөрөгдсөн, мэдэгдэл асаасан утсууд руу илгээнэ (userIds өгвөл зөвхөн тэдгээр хүмүүсийн утас руу).
 * Хүчингүй болсон захиалгыг (утаснаас аппыг устгасан г.м) арилгана. Алдаа гарсан ч үндсэн үйлдлийг зогсоохгүй.
 */
export async function pushToDevices(payload: PushPayload, userIds?: string[]) {
  if (!configure()) return { sent: 0, failed: 0 };
  const devices = await Device.find({
    status: "approved",
    "push.endpoint": { $exists: true },
    ...(userIds ? { userId: { $in: userIds } } : {}),
  })
    .select("push")
    .lean<{ _id: unknown; push: webpush.PushSubscription }[]>();

  const body = JSON.stringify({ url: "/app", ...payload });
  const results = await Promise.allSettled(
    devices.map((d) => webpush.sendNotification(d.push, body, { TTL: 24 * 60 * 60, urgency: "high" }))
  );

  const gone = devices.filter((d, i) => {
    const r = results[i];
    return r.status === "rejected" && r.reason instanceof WebPushError && [404, 410].includes(r.reason.statusCode);
  });
  if (gone.length) await Device.updateMany({ _id: { $in: gone.map((d) => d._id) } }, { $unset: { push: 1 } });

  const failed = results.filter((r) => r.status === "rejected");
  for (const r of failed) console.error("[push] илгээж чадсангүй:", (r as PromiseRejectedResult).reason);
  return { sent: results.length - failed.length, failed: failed.length };
}
