import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import Device from "@/lib/models/Device";
import Personnel from "@/lib/models/Personnel";
import { getCurrentRole } from "@/lib/auth-role";

/** Админ өөрийгөө хааж, устгаж чадахгүй */
async function guard(params: Promise<{ id: string }>) {
  if ((await getCurrentRole()) !== "admin") {
    return { error: NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 }) };
  }
  const { id } = await params;
  const me = (await auth()).userId;
  if (id === me) return { error: NextResponse.json({ error: "Өөрийгөө хааж, устгах боломжгүй" }, { status: 400 }) };
  return { id, me: me ?? "" };
}

/** Тэр хүний утсан дээрх аппыг хаана — хаагдсан, устгагдсан хүнд зарлан мэдээлэл очихгүй */
async function revokeDevices(userId: string, decidedBy: string) {
  await connectToDatabase();
  await Device.updateMany(
    { userId, status: { $in: ["pending", "approved"] } },
    { $set: { status: "revoked", decidedBy, decidedAt: new Date() }, $unset: { push: 1 } }
  );
}

/** Хаах / нээх. body: { action: "ban" | "unban" } — хаагдсан хүн нэвтэрч чадахгүй, бүх нэвтрэлт нь дуусна */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(params);
  if (g.error) return g.error;
  const { action } = (await req.json().catch(() => null)) ?? {};
  if (action !== "ban" && action !== "unban") return NextResponse.json({ error: "Буруу үйлдэл" }, { status: 400 });

  const client = await clerkClient();
  if (action === "ban") {
    await client.users.banUser(g.id);
    await revokeDevices(g.id, g.me);
  } else {
    await client.users.unbanUser(g.id);
  }
  return NextResponse.json({ ok: true });
}

/** Устгах — алба хаагчийн бүртгэл (ирц, хуваарь) үлдэж, зөвхөн хэрэглэгчтэй холбоос нь салгагдана */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(params);
  if (g.error) return g.error;
  const client = await clerkClient();
  await client.users.deleteUser(g.id);
  await revokeDevices(g.id, g.me);
  await Personnel.updateMany({ userId: g.id }, { $unset: { userId: 1 } });
  return NextResponse.json({ ok: true });
}
