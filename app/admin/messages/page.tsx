"use client";

import { useCallback, useEffect, useState } from "react";

type Message = {
  _id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  read: boolean;
  createdAt: string;
};

const smallButton = "px-3 py-1.5 text-xs font-semibold rounded-md border border-border text-foreground";

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await (await fetch("/api/admin/messages")).json();
    setMessages(data.messages ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  async function setRead(m: Message, read: boolean) {
    await fetch(`/api/admin/messages/${m._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read }),
    });
    load();
  }

  async function remove(m: Message) {
    if (!confirm(`${m.name}-ийн «${m.subject}» зурвасыг устгах уу?`)) return;
    await fetch(`/api/admin/messages/${m._id}`, { method: "DELETE" });
    load();
  }

  const unread = messages.filter((m) => !m.read).length;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ирсэн зурвас</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Сайтын «Холбоо барих» маягтаар иргэдийн илгээсэн зурвас. Хариуг илгээгчийн и-мэйл рүү бичнэ.
          {unread > 0 && <span className="text-primary"> Уншаагүй: {unread}</span>}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Ачааллаж байна...</p>
      ) : messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">Зурвас ирээгүй байна.</p>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <div
              key={m._id}
              className={`rounded-xl border bg-card p-4 space-y-2 ${m.read ? "border-border" : "border-primary/60"}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-bold text-foreground">
                  {!m.read && <span className="text-primary text-xs font-semibold uppercase mr-2">Шинэ</span>}
                  {m.subject}
                </p>
                <p className="text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleString("mn-MN")}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                {m.name} ·{" "}
                <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`} className="text-primary hover:underline">
                  {m.email}
                </a>
              </p>
              <p className="text-sm text-foreground whitespace-pre-line">{m.message}</p>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setRead(m, !m.read)} className={smallButton}>
                  {m.read ? "Уншаагүй болгох" : "Уншсан"}
                </button>
                <button
                  onClick={() => remove(m)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md border border-red-400/40 text-red-400"
                >
                  Устгах
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
