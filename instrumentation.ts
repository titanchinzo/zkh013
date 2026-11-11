// Сервер асахад нэг удаа ажиллана: харуул хоногийн манааны өдрийн «Тайван хоноорой» мэдэгдэл, товлосон зарлан
// мэдээллийг хуваарьт оруулж, чатын хуучин хадгалалтыг цэвэрлэнэ. Зөвхөн ангийн сервер дээр — хуучин Vercel хуулбар
// бүх хүсэлтийг unit013.mn руу шилжүүлдэг.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.VERCEL) {
    const { startDutyReminders } = await import("./lib/duty-reminders");
    startDutyReminders();
    const { startAlertScheduler } = await import("./lib/alerts");
    startAlertScheduler();
    const { startChatFileSweeper } = await import("./lib/chat-files");
    startChatFileSweeper();
    const { migrateLegacyChat } = await import("./lib/chat-migrate");
    migrateLegacyChat().catch((err) => console.error("[chat] хуучин чатыг цэвэрлэж чадсангүй:", err));
  }
}
