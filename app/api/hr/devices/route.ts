import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Device from "@/lib/models/Device";
import Personnel from "@/lib/models/Personnel";
import { getCurrentRole } from "@/lib/auth-role";
import { isHrRole } from "@/lib/roles";

// Утасны бүртгэл: шийдвэр хүлээж буй хүсэлтүүд, зөвшөөрөгдсөн утсууд, сүүлийн шийдвэрүүд
export async function GET() {
  if (!isHrRole(await getCurrentRole())) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  await connectToDatabase();

  const [pending, approved, history, personnel] = await Promise.all([
    Device.find({ status: "pending" }).sort({ createdAt: 1 }).select("-tokenHash -push").lean(),
    Device.find({ status: "approved" }).sort({ decidedAt: -1 }).select("-tokenHash").lean(),
    Device.find({ status: { $in: ["rejected", "revoked"] } }).sort({ decidedAt: -1 }).limit(30).select("-tokenHash -push").lean(),
    Personnel.find({ active: true }).sort({ name: 1 }).select("rank name position userId").lean(),
  ]);

  return NextResponse.json({
    pending,
    // Мэдэгдэл асаасан эсэхийг л харуулна, захиалгын нууц түлхүүрийг биш
    approved: approved.map(({ push, ...d }) => ({ ...d, pushEnabled: Boolean(push?.endpoint) })),
    history,
    personnel,
  });
}
