import { NextRequest, NextResponse } from "next/server";
import { getActor } from "@/lib/actor";
import { decideDevice } from "@/lib/device-decision";
import { isHrRole } from "@/lib/roles";

/**
 * Утсан дээрх апп: утасны хүсэлтийг зөвшөөрнө/татгалзана — зөвхөн хүний нөөц, админ. body: { action: "approve" |
 * "reject", personnelId? } — approve: personnelId — холбох алба хаагч, "new" бол хүсэлтэд бичсэн мэдээллээр шинээр
 * бүртгэнэ. Гээсэн утсыг хүчингүй болгох (revoke) нь зөвхөн сайтын «Утасны бүртгэл» хуудсанд.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor || !isHrRole(actor.role)) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const action = body?.action;
  if (action !== "approve" && action !== "reject") return NextResponse.json({ error: "Буруу үйлдэл" }, { status: 400 });

  const result = await decideDevice(id, { action, personnelId: body?.personnelId }, actor.userId);
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: result.status });
}
