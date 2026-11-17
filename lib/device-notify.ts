import "server-only";
import { hrStaffIds } from "@/lib/actor";
import { formatPhone, personnelLabel } from "@/lib/hr";
import { pushToDevices } from "@/lib/push";

// Утас бүртгүүлэх хүсэлтийн мэдэгдэл: зөвшөөрөл хүлээж буй шинэ хүсэлт ирэхэд хүний нөөц, админуудын утсанд очно.
// Дарахад апп-ын нүүр нээгдэж, дээд талд нь «Утасны хүсэлт» карт гарна — утсаасаа шууд зөвшөөрнө, татгалзана.

type DeviceRequest = { userId: string; rank?: string; name?: string; phone?: string };

/** Шинэ хүсэлтийг хүний нөөц, админуудад (хүсэлт гаргагчаас бусад) мэдэгдэнэ. Ижил хүний дахин илгээсэн хүсэлт өмнөхөө орлоно. */
export async function notifyDeviceRequest(request: DeviceRequest) {
  try {
    const ids = await hrStaffIds(request.userId);
    if (!ids.length) return;
    const who = personnelLabel({ rank: request.rank, name: request.name || "Нэргүй" });
    await pushToDevices(
      {
        title: "Утас бүртгүүлэх хүсэлт",
        body: [who, formatPhone(request.phone)].filter(Boolean).join(" · "),
        url: "/app",
        tag: `device-request-${request.userId}`,
        kind: "request",
      },
      ids
    );
  } catch (err) {
    console.error("[device] хүний нөөцөд мэдэгдэж чадсангүй:", err);
  }
}
