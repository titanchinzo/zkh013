import "server-only";
import { newsReviewerIds } from "@/lib/actor";
import { pushToDevices } from "@/lib/push";

// Мэдээний ажлын урсгалын мэдэгдэл: нийтлэгч илгээхэд хянагчдын утсанд, хянагч шийдэхэд зохиогчийн утсанд.
// Дарахад апп-ын «Мэдээ» хэсэгт тэр мэдээ нээгдэнэ.

type NewsRef = { _id: unknown; title: string; authorId: string; authorName: string };

const link = (news: NewsRef) => `/app?news=${String(news._id)}`;

/** Хяналт хүлээж буй мэдээг хянагч, админуудад (зохиогчоос бусад) мэдэгдэнэ */
export async function notifyReviewers(news: NewsRef) {
  try {
    const ids = await newsReviewerIds(news.authorId);
    if (!ids.length) return;
    await pushToDevices(
      { title: "Хянах мэдээ", body: `${news.authorName}: ${news.title}`, url: link(news), tag: `news-${String(news._id)}`, kind: "news" },
      ids
    );
  } catch (err) {
    console.error("[news] хянагчдад мэдэгдэж чадсангүй:", err);
  }
}

/** Хянагчийн шийдвэрийг зохиогчид мэдэгдэнэ */
export async function notifyAuthor(news: NewsRef, approved: boolean) {
  try {
    await pushToDevices(
      {
        title: approved ? "Таны мэдээ нийтлэгдлээ" : "Таны мэдээг буцаалаа",
        body: news.title,
        url: link(news),
        tag: `news-${String(news._id)}`,
        kind: "news",
      },
      [news.authorId]
    );
  } catch (err) {
    console.error("[news] зохиогчид мэдэгдэж чадсангүй:", err);
  }
}
