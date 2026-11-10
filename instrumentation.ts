// Сервер асахад нэг удаа ажиллана: харуул хоногийн манааны өдрийн «Тайван хоноорой» мэдэгдлийг хуваарьт оруулна.
// Зөвхөн ангийн сервер дээр — хуучин Vercel хуулбар бүх хүсэлтийг unit013.mn руу шилжүүлдэг.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.VERCEL) {
    const { startDutyReminders } = await import("./lib/duty-reminders");
    startDutyReminders();
  }
}
