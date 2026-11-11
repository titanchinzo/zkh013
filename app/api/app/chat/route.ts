import { NextRequest, NextResponse } from "next/server";
import Conversation from "@/lib/models/Conversation";
import Personnel from "@/lib/models/Personnel";
import { approvedLastSeen, getChatUser, isOnline } from "@/lib/chat";

type ConversationDoc = {
  members: string[];
  lastMessage?: { text: string; sender: string; at: Date };
  unread?: Record<string, number>;
};
type PersonDoc = { userId: string; rank: string; name: string; position: string; photo?: string; active: boolean };

/**
 * Утсан дээрх чатын жагсаалт: апп ашиглаж буй алба хаагчид (идэвхтэй эсэх, сүүлд хэзээ идэвхтэй байсан), тэдэнтэй
 * хийсэн чатын сүүлийн зурвас, уншаагүй тоо. ?summary=1 — зөвхөн уншаагүй нийт тоо (нүүр хуудсанд).
 */
export async function GET(req: NextRequest) {
  const auth = await getChatUser();
  if ("error" in auth) return auth.error;
  const { me } = auth;

  const summary = req.nextUrl.searchParams.get("summary") === "1";
  const conversations = await Conversation.find({ members: me })
    .sort({ "lastMessage.at": -1 })
    .limit(300)
    .select(summary ? "unread" : "members lastMessage unread")
    .lean<ConversationDoc[]>();
  const unreadTotal = conversations.reduce((sum, c) => sum + (c.unread?.[me] ?? 0), 0);
  if (summary) return NextResponse.json({ unreadTotal });

  // Хүний нөөц зөвшөөрсөн утастай хүмүүс + өмнө нь чатласан хүмүүс (утсаа хүчингүй болгуулсан ч түүх нь харагдана)
  const seen = await approvedLastSeen();
  const partnerOf = (c: ConversationDoc) => c.members.find((m) => m !== me) ?? me;
  const ids = [...new Set([...seen.keys(), ...conversations.map(partnerOf)])].filter((id) => id !== me);
  const people = await Personnel.find({ userId: { $in: ids } })
    .select("userId rank name position photo active")
    .lean<PersonDoc[]>();
  const personOf = new Map(people.map((p) => [p.userId, p]));
  const conversationOf = new Map(conversations.map((c) => [partnerOf(c), c]));

  const now = Date.now();
  const rows = ids.flatMap((id) => {
    const person = personOf.get(id);
    const conversation = conversationOf.get(id);
    const contact = seen.has(id) && Boolean(person?.active);
    if (!contact && !conversation?.lastMessage) return [];
    const lastSeenAt = seen.get(id) ?? null;
    return [
      {
        userId: id,
        rank: person?.rank ?? "",
        name: person?.name ?? "Хасагдсан хэрэглэгч",
        position: person?.position ?? "",
        photo: person?.photo ?? "",
        // Идэвхгүй болгосон (халагдсан) хүний төлөвийг харуулахгүй
        online: Boolean(person?.active) && isOnline(lastSeenAt, now),
        lastSeenAt: person?.active ? lastSeenAt : null,
        canMessage: Boolean(person?.active),
        lastMessage: conversation?.lastMessage
          ? { text: conversation.lastMessage.text, mine: conversation.lastMessage.sender === me, at: conversation.lastMessage.at }
          : null,
        unread: conversation?.unread?.[me] ?? 0,
      },
    ];
  });

  // Сүүлд чатласан нь эхэнд, дараа нь идэвхтэй хүмүүс, үлдсэн нь нэрээр
  rows.sort((a, b) => {
    if (a.lastMessage || b.lastMessage) {
      return (b.lastMessage ? new Date(b.lastMessage.at).getTime() : 0) - (a.lastMessage ? new Date(a.lastMessage.at).getTime() : 0);
    }
    if (a.online !== b.online) return a.online ? -1 : 1;
    return a.name.localeCompare(b.name, "mn");
  });

  return NextResponse.json({ unreadTotal, people: rows });
}
