import { NextResponse } from "next/server";
import { markDeviceAway } from "@/lib/device";
import { clearViewing } from "@/lib/chat";
import { ONLINE_MS } from "@/lib/chat-shared";

// Аппыг хаах/далдлахад утас navigator.sendBeacon-оор мэдэгдэнэ: «Идэвхтэй» төлөв шууд унтарч, шинэ зурвас
// мэдэгдлээр очно (чатаа нээлттэй орхисон гэж үзэхгүй)
export async function POST() {
  const userId = await markDeviceAway(ONLINE_MS);
  if (userId) clearViewing(userId);
  return new NextResponse(null, { status: 204 });
}
