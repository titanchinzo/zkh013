import { NextResponse } from "next/server";
import { getCurrentDevice, revokeUnlock } from "@/lib/device";

/** Аппыг шууд түгжинэ — апп далд орох (өөр апп нээх, дэлгэц унтрах) бүрд утас navigator.sendBeacon-оор илгээнэ */
export async function POST() {
  const current = await getCurrentDevice();
  if (current?.device.status === "approved") await revokeUnlock(current.device._id);
  return new NextResponse(null, { status: 204 });
}
