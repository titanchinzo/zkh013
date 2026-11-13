import { NextRequest, NextResponse } from "next/server";
import ChatDeletion from "@/lib/models/ChatDeletion";
import ChatMessage from "@/lib/models/ChatMessage";
import Personnel from "@/lib/models/Personnel";
import { approvedLastSeen, getChatUser, isOnline } from "@/lib/chat";
import { groupOf, loadGroup, memberLabel } from "@/lib/chat-group";
import { previewText } from "@/lib/chat-shared";

type PersonDoc = { userId: string; rank: string; name: string; position: string; group?: string; photo?: string; active: boolean };
type PendingDoc = { _id: string; count: number; text: string; file?: { name: string } | null; ephemeral?: boolean; at: Date };
type GroupPendingDoc = { sender: string; text: string; file?: { name: string; type?: string } | null; createdAt: Date };

/**
 * Утсан дээрх чатын жагсаалт: апп ашиглаж буй алба хаагчид (идэвхтэй эсэх, сүүлд хэзээ идэвхтэй байсан), тэднээс
 * ирсэн уншаагүй зурвас (тоо, сүүлийнх нь). Өмнөх чатын түүх серверт байхгүй — утас өөрөө хадгалдаг.
 * ?summary=1 — зөвхөн уншаагүй нийт тоо (нүүр хуудсанд). removed — илгээгч нь «хоёулангаас устгасан» зурвасууд
 * (утас түүхээсээ арилгаад /api/app/chat/removed-д мэдэгдэнэ). group — миний бүлгийн чат (гишүүдийн тоо, уншаагүй
 * зурвас); бүлэггүй бол null.
 */
export async function GET(req: NextRequest) {
  const auth = await getChatUser();
  if ("error" in auth) return auth.error;
  const { me, person } = auth;

  // Надад ирсэн, хараахан уншаагүй зурвасууд — илгээгч бүрээр
  const pending = await ChatMessage.aggregate<PendingDoc>([
    { $match: { recipient: me } },
    { $sort: { _id: -1 } },
    {
      $group: {
        _id: "$sender",
        count: { $sum: 1 },
        text: { $first: "$text" },
        file: { $first: "$file" },
        ephemeral: { $first: "$ephemeral" },
        at: { $first: "$createdAt" },
      },
    },
  ]);
  // Миний бүлгийн чат: гишүүд, бусдын илгээсэн миний уншаагүй зурвасууд
  const myGroup = await groupOf(person.group);
  const group = myGroup ? await loadGroup(myGroup.id, me) : null;
  const groupPending = group
    ? await ChatMessage.find({ group: group.id, readBy: { $ne: me } })
        .sort({ _id: -1 })
        .select("sender text file createdAt")
        .lean<GroupPendingDoc[]>()
    : [];
  const unreadTotal = pending.reduce((sum, p) => sum + p.count, 0) + groupPending.length;
  if (req.nextUrl.searchParams.get("summary") === "1") return NextResponse.json({ unreadTotal });

  // Хүний нөөц зөвшөөрсөн утастай хүмүүс + надад уншаагүй зурвас үлдээсэн хүмүүс (халагдсан ч уншиж болно)
  const seen = await approvedLastSeen();
  const pendingOf = new Map(pending.map((p) => [p._id, p]));
  const ids = [...new Set([...seen.keys(), ...pendingOf.keys()])].filter((id) => id !== me);
  const people = await Personnel.find({ userId: { $in: ids } })
    .select("userId rank name position group photo active")
    .lean<PersonDoc[]>();
  const personOf = new Map(people.map((p) => [p.userId, p]));

  const now = Date.now();
  const rows = ids.flatMap((id) => {
    const person = personOf.get(id);
    const waiting = pendingOf.get(id);
    const contact = seen.has(id) && Boolean(person?.active);
    if (!contact && !waiting) return [];
    // Идэвхгүй болгосон (халагдсан) хүний төлөвийг харуулахгүй
    const lastSeenAt = person?.active ? (seen.get(id) ?? null) : null;
    return [
      {
        userId: id,
        rank: person?.rank ?? "",
        name: person?.name ?? "Хасагдсан хэрэглэгч",
        // Албан тушаалгүй бол бүлэг (рот, алба…) — олон хүнтэй жагсаалтад ялгагдана
        position: person?.position || person?.group || "",
        photo: person?.photo ?? "",
        online: isOnline(lastSeenAt, now),
        lastSeenAt,
        canMessage: Boolean(person?.active),
        // Нууц зурвасын текстийг жагсаалтад харуулахгүй, файлыг нэрээр нь
        pending: waiting ? { count: waiting.count, text: previewText(waiting).slice(0, 200), at: waiting.at } : null,
      },
    ];
  });

  const removed = await ChatDeletion.find({ recipient: me })
    .select("sender messageId group")
    .limit(1000)
    .lean<{ sender: string; messageId: string; group?: string }[]>();

  const labelOf = new Map((group?.members ?? []).map((m) => [m.userId, memberLabel(m)]));
  const latest = groupPending[0];
  return NextResponse.json({
    me,
    unreadTotal,
    people: rows,
    group: group
      ? {
          id: group.id,
          name: group.name,
          members: group.members.length,
          pending: latest
            ? {
                count: groupPending.length,
                text: `${labelOf.get(latest.sender) ?? ""}: ${previewText(latest)}`.slice(0, 200),
                at: latest.createdAt,
              }
            : null,
        }
      : null,
    removed: removed.map((r) => ({ sender: r.sender, id: r.messageId, ...(r.group ? { group: r.group } : {}) })),
  });
}
