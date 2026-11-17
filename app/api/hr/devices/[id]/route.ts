import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentRole } from "@/lib/auth-role";
import { decideDevice } from "@/lib/device-decision";
import { isHrRole } from "@/lib/roles";

/**
 * Утасны хүсэлтийг шийднэ. body: { action: "approve" | "reject" | "revoke", personnelId?, signOut? }
 * - approve: personnelId — холбох алба хаагч, "new" бол хүсэлтэд бичсэн мэдээллээр шинээр бүртгэнэ.
 *   Хүн бүр нэг л утастай: тэр хүний өмнөх зөвшөөрөгдсөн утас хүчингүй болно.
 * - revoke: гээсэн/солисон утас. signOut: true бол тэр хүнийг бүх төхөөрөмжөөс сайтаас гаргана.
 * Логик нь lib/device-decision.ts-д (утсан дээрх апп мөн ашиглана).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isHrRole(await getCurrentRole())) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const action = body?.action;
  if (!["approve", "reject", "revoke"].includes(action)) {
    return NextResponse.json({ error: "Буруу үйлдэл" }, { status: 400 });
  }

  const result = await decideDevice(
    id,
    { action, personnelId: body?.personnelId, signOut: body?.signOut === true },
    (await auth()).userId ?? ""
  );
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: result.status });
}
