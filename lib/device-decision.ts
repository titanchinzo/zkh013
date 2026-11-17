import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import Device from "@/lib/models/Device";
import Personnel from "@/lib/models/Personnel";

// Утасны хүсэлтийн шийдвэр (хүний нөөц, админ) — сайтын «Утасны бүртгэл» хуудас болон утсан дээрх апп хоёулаа ашиглана.

export type DeviceDecision = {
  action: "approve" | "reject" | "revoke";
  /** approve: холбох алба хаагчийн id, эсвэл "new" — хүсэлтэд бичсэн мэдээллээр шинээр бүртгэнэ */
  personnelId?: unknown;
  /** revoke: тэр хүнийг сайтын бүх нэвтрэлтээс мөн гаргана */
  signOut?: boolean;
};

export type DecisionResult = { ok: true } | { ok: false; status: number; error: string };

const fail = (status: number, error: string): DecisionResult => ({ ok: false, status, error });

/**
 * Утасны хүсэлтийг шийднэ.
 * - approve: personnelId — холбох алба хаагч, "new" бол хүсэлтэд бичсэн мэдээллээр шинээр бүртгэнэ. Хүн бүр нэг л
 *   утастай: тэр хүний өмнөх зөвшөөрөгдсөн утас хүчингүй болно.
 * - reject: хүсэлтийг татгалзана.
 * - revoke: гээсэн/солисон утас. signOut: true бол тэр хүнийг бүх төхөөрөмжөөс сайтаас гаргана.
 * decidedBy — шийдсэн хүний Clerk userId.
 */
export async function decideDevice(id: string, decision: DeviceDecision, decidedBy: string): Promise<DecisionResult> {
  if (!isValidObjectId(id)) return fail(404, "Олдсонгүй");
  const { action } = decision;

  await connectToDatabase();
  const device = await Device.findById(id);
  if (!device) return fail(404, "Олдсонгүй");
  const allowed = action === "revoke" ? device.status === "approved" : device.status === "pending";
  if (!allowed) return fail(409, "Энэ хүсэлтийг аль хэдийн шийдсэн байна");

  const stamp = { decidedBy, decidedAt: new Date() };

  if (action === "approve") {
    const personnelId = decision.personnelId;
    if (personnelId === "new") {
      // Энэ хүн өөр алба хаагчтай холбогдсон бол давхар бүртгэл үүсгэхгүй
      const linked = await Personnel.exists({ userId: device.userId });
      if (!linked) {
        await Personnel.create({
          rank: device.rank,
          name: device.name,
          position: device.position,
          phone: device.phone,
          userId: device.userId,
        });
      }
    } else if (personnelId) {
      if (typeof personnelId !== "string" || !isValidObjectId(personnelId)) return fail(400, "Алба хаагч олдсонгүй");
      const person = await Personnel.findById(personnelId);
      if (!person) return fail(400, "Алба хаагч олдсонгүй");
      if (person.userId && person.userId !== device.userId) {
        return fail(409, "Энэ алба хаагч өөр хэрэглэгчтэй холбогдсон байна");
      }
      // Хэрэглэгч нэг л алба хаагчтай холбогдоно
      await Personnel.updateMany({ userId: device.userId, _id: { $ne: person._id } }, { $unset: { userId: 1 } });
      person.userId = device.userId;
      // Хүсэлтэд бичсэн утасны дугаараар дутууг нь бөглөнө
      if (!person.phone && device.phone) person.phone = device.phone;
      await person.save();
    } else {
      return fail(400, "Алба хаагчийг сонгоно уу");
    }
    await Device.updateMany(
      { userId: device.userId, status: "approved", _id: { $ne: device._id } },
      { $set: { status: "revoked", ...stamp }, $unset: { push: 1 } }
    );
    device.set({ status: "approved", ...stamp });
  } else {
    device.set({ status: action === "reject" ? "rejected" : "revoked", ...stamp });
    device.push = undefined;
  }
  await device.save();

  if (action === "revoke" && decision.signOut === true) {
    const client = await clerkClient();
    const { data } = await client.sessions.getSessionList({ userId: device.userId, status: "active" });
    await Promise.all(data.map((s) => client.sessions.revokeSession(s.id)));
  }

  return { ok: true };
}
