import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import Device from "@/lib/models/Device";
import Personnel from "@/lib/models/Personnel";
import { getCurrentRole } from "@/lib/auth-role";
import { isHrRole } from "@/lib/roles";

/**
 * Утасны хүсэлтийг шийднэ. body: { action: "approve" | "reject" | "revoke", personnelId?, signOut? }
 * - approve: personnelId — холбох алба хаагч, "new" бол хүсэлтэд бичсэн мэдээллээр шинээр бүртгэнэ.
 *   Хүн бүр нэг л утастай: тэр хүний өмнөх зөвшөөрөгдсөн утас хүчингүй болно.
 * - revoke: гээсэн/солисон утас. signOut: true бол тэр хүнийг бүх төхөөрөмжөөс сайтаас гаргана.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isHrRole(await getCurrentRole())) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const action = body?.action;
  if (!["approve", "reject", "revoke"].includes(action)) {
    return NextResponse.json({ error: "Буруу үйлдэл" }, { status: 400 });
  }

  await connectToDatabase();
  const device = await Device.findById(id);
  if (!device) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  const allowed = action === "revoke" ? device.status === "approved" : device.status === "pending";
  if (!allowed) return NextResponse.json({ error: "Энэ хүсэлтийг аль хэдийн шийдсэн байна" }, { status: 409 });

  const decision = { decidedBy: (await auth()).userId ?? "", decidedAt: new Date() };

  if (action === "approve") {
    const personnelId = body?.personnelId;
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
      if (!isValidObjectId(personnelId)) return NextResponse.json({ error: "Алба хаагч олдсонгүй" }, { status: 400 });
      const person = await Personnel.findById(personnelId);
      if (!person) return NextResponse.json({ error: "Алба хаагч олдсонгүй" }, { status: 400 });
      if (person.userId && person.userId !== device.userId) {
        return NextResponse.json({ error: "Энэ алба хаагч өөр хэрэглэгчтэй холбогдсон байна" }, { status: 409 });
      }
      // Хэрэглэгч нэг л алба хаагчтай холбогдоно
      await Personnel.updateMany({ userId: device.userId, _id: { $ne: person._id } }, { $unset: { userId: 1 } });
      person.userId = device.userId;
      // Хүсэлтэд бичсэн утасны дугаараар дутууг нь бөглөнө
      if (!person.phone && device.phone) person.phone = device.phone;
      await person.save();
    } else {
      return NextResponse.json({ error: "Алба хаагчийг сонгоно уу" }, { status: 400 });
    }
    await Device.updateMany(
      { userId: device.userId, status: "approved", _id: { $ne: device._id } },
      { $set: { status: "revoked", ...decision }, $unset: { push: 1 } }
    );
    device.set({ status: "approved", ...decision });
  } else {
    device.set({ status: action === "reject" ? "rejected" : "revoked", ...decision });
    device.push = undefined;
  }
  await device.save();

  if (action === "revoke" && body?.signOut === true) {
    const client = await clerkClient();
    const { data } = await client.sessions.getSessionList({ userId: device.userId, status: "active" });
    await Promise.all(data.map((s) => client.sessions.revokeSession(s.id)));
  }

  return NextResponse.json({ ok: true });
}
