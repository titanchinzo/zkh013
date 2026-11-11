"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, Search, SendHorizontal } from "lucide-react";
import { Avatar } from "@/components/app/avatar";
import { CHAT_LIMITS, POLL_MS, chatDay, chatListTime, chatTime, presenceText, sameDay } from "@/lib/chat-shared";

// Утсан дээрх аппын чат: апп ашиглаж буй алба хаагчдын жагсаалт (хэн идэвхтэй), хоёр хүний чат.
// Апп нээлттэй үед сервер рүү тогтмол асууж шинэ зурвас авна; хаалттай үед зурвас мэдэгдлээр очно.

type LastMessage = { text: string; mine: boolean; at: string };
export type ChatPerson = {
  userId: string;
  rank: string;
  name: string;
  position: string;
  photo: string;
  online: boolean;
  lastSeenAt: string | null;
  canMessage: boolean;
  lastMessage: LastMessage | null;
  unread: number;
};
type Message = { id: string; text: string; mine: boolean; at: string; pending?: boolean; failed?: string };
type Thread = {
  person: Pick<ChatPerson, "userId" | "rank" | "name" | "position" | "photo">;
  online: boolean;
  lastSeenAt: string | null;
  canMessage: boolean;
  readAt: string | null;
};

const fullName = (p: { rank: string; name: string }) => (p.rank ? `${p.rank} ${p.name}` : p.name);

async function errorOf(res: Response | null, fallback: string) {
  return (await res?.json().catch(() => null))?.error ?? fallback;
}

/** Апп дэлгэц дээр харагдаж байх үед fn-ийг ms тутам дуудна; апп руу буцаж ороход шууд дуудна */
export function usePolling(fn: () => void, ms: number, enabled = true) {
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  });
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (document.visibilityState === "visible") latest.current();
    };
    const id = window.setInterval(tick, ms);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [ms, enabled]);
}

// Чатаас буцаж ороход жагсаалт шууд харагдана (дараа нь шинэчилнэ)
let listCache: ChatPerson[] | null = null;
// Илгээж буй зурвасын түр id
let tempSeq = 0;

/** Чатын жагсаалт: хайлт, «Одоо идэвхтэй» хүмүүс, сүүлд чатласан нь эхэндээ */
export function ChatList({
  onOpen,
  onUnread,
  pushEnabled,
}: {
  onOpen: (userId: string) => void;
  onUnread: (count: number) => void;
  pushEnabled: boolean;
}) {
  const [people, setPeople] = useState<ChatPerson[] | null>(listCache);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/app/chat", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) {
      setError(await errorOf(res, "Сервертэй холбогдож чадсангүй"));
      return;
    }
    const data: { unreadTotal: number; people: ChatPerson[] } = await res.json();
    listCache = data.people;
    setError("");
    setPeople(data.people);
    onUnread(data.unreadTotal);
  }, [onUnread]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);
  usePolling(load, POLL_MS.list);

  if (!people) return <p className="text-sm text-muted-foreground">{error || "Ачааллаж байна..."}</p>;

  const q = query.trim().toLowerCase();
  const shown = q ? people.filter((p) => `${p.rank} ${p.name} ${p.position}`.toLowerCase().includes(q)) : people;
  const active = people.filter((p) => p.online && p.canMessage);

  return (
    <section className="space-y-4">
      <label className="relative block">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Хүн хайх"
          aria-label="Хүн хайх"
          className="h-10 w-full rounded-full border border-border bg-background pl-9 pr-4 text-base text-foreground placeholder:text-muted-foreground"
        />
      </label>

      {!pushEnabled && (
        <p className="rounded-lg border border-yellow-400/40 bg-yellow-400/10 px-3 py-2 text-xs text-yellow-300">
          Апп хаалттай үед шинэ зурвасын мэдэгдэл авахын тулд «Нүүр» хэсгээс «Мэдэгдэл асаах» дарна уу.
        </p>
      )}

      {!q && active.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Одоо идэвхтэй · {active.length}</p>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {active.map((p) => (
              <button key={p.userId} onClick={() => onOpen(p.userId)} className="flex w-16 shrink-0 flex-col items-center gap-1">
                <Avatar person={p} size={52} online />
                <span className="w-full truncate text-center text-[11px] text-foreground">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{q ? "Олдсонгүй." : "Апп ашиглаж буй өөр хүн одоогоор алга."}</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {shown.map((p) => (
            <ChatRow key={p.userId} person={p} onOpen={onOpen} />
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">Албаны нууцад хамаарах мэдээллийг чатаар бичихгүй.</p>
    </section>
  );
}

function ChatRow({ person: p, onOpen }: { person: ChatPerson; onOpen: (userId: string) => void }) {
  const unread = p.unread > 0;
  const subtitle = p.lastMessage
    ? `${p.lastMessage.mine ? "Та: " : ""}${p.lastMessage.text}`
    : [p.position, p.online ? "Идэвхтэй" : ""].filter(Boolean).join(" · ");
  return (
    <li>
      <button onClick={() => onOpen(p.userId)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-muted/60">
        <Avatar person={p} size={46} online={p.online} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={`truncate text-foreground ${unread ? "font-bold" : "font-semibold"}`}>{fullName(p)}</span>
            {p.lastMessage && (
              <span className={`shrink-0 text-[11px] ${unread ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                {chatListTime(p.lastMessage.at)}
              </span>
            )}
          </span>
          <span className="flex items-center justify-between gap-2">
            <span className={`truncate text-sm ${unread ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
              {subtitle || " "}
            </span>
            {unread && (
              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                {p.unread > 99 ? "99+" : p.unread}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

/** Шинэ зурвасуудыг нэмнэ: давхардлыг хасаж, илгээж буй зурвасыг серверийнхээр орлуулж, үүссэн дарааллаар нь */
function merge(prev: Message[], incoming: Message[]): Message[] {
  const known = new Set(prev.map((m) => m.id));
  const pending = prev.filter((m) => m.pending);
  const confirmed = prev.filter((m) => !m.pending);
  for (const m of incoming) {
    if (known.has(m.id)) continue;
    known.add(m.id);
    if (m.mine) {
      const i = pending.findIndex((p) => !p.failed && p.text === m.text);
      if (i >= 0) pending.splice(i, 1);
    }
    confirmed.push(m);
  }
  // MongoDB-ийн id үүссэн цагаараа эрэмбэлэгддэг (ижил урттай hex)
  confirmed.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return [...confirmed, ...pending];
}

/** Утасны гар нээгдэхэд харагдах хэсэг — чатын цонхыг түүнд багтааж, бичих хэсэг гарын дээр үлдэнэ */
function useVisualViewport() {
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setBox({ top: vv.offsetTop, height: vv.height });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return box;
}

/** Хоёр хүний чат — бүтэн дэлгэцээр */
export function Conversation({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [newBelow, setNewBelow] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastId = useRef<string | null>(null);
  // Хамгийн доор байгаа эсэх, дараагийн зурагт доош гүйлгэх эсэх, өмнөх зурвас нэмэхэд байрлалаа хадгалах
  const atBottom = useRef(true);
  const stick = useRef(true);
  const keepFromBottom = useRef<number | null>(null);
  const box = useVisualViewport();

  const poll = useCallback(async () => {
    const after = lastId.current;
    const res = await fetch(`/api/app/chat/${userId}${after ? `?after=${after}` : ""}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) {
      setError(await errorOf(res, "Сервертэй холбогдож чадсангүй"));
      return;
    }
    const data: Thread & { messages: Message[]; hasMore: boolean } = await res.json();
    setError("");
    setThread({ person: data.person, online: data.online, lastSeenAt: data.lastSeenAt, canMessage: data.canMessage, readAt: data.readAt });
    if (!after) setHasMore(data.hasMore);
    if (data.messages.length) {
      lastId.current = data.messages[data.messages.length - 1].id;
      if (atBottom.current) stick.current = true;
      else if (data.messages.some((m) => !m.mine)) setNewBelow(true);
      setMessages((prev) => merge(prev, data.messages));
    }
  }, [userId]);

  useEffect(() => {
    poll();
  }, [poll]);
  usePolling(poll, POLL_MS.conversation);

  // Чат нээлттэй үед ард байгаа хуудас гүйлгэгдэхгүй
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (keepFromBottom.current !== null) {
      el.scrollTop = el.scrollHeight - keepFromBottom.current;
      keepFromBottom.current = null;
    } else if (stick.current) {
      el.scrollTop = el.scrollHeight;
      stick.current = false;
    }
  }, [messages]);

  // Гар нээгдэж цонх багасахад хамгийн доод зурвас харагдсаар байна
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [box?.height]);

  // Бичих талбар бичвэртэйгээ хамт өндөрсөнө (≈5 мөр хүртэл)
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [text]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottom.current) setNewBelow(false);
  }

  function scrollToBottom() {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setNewBelow(false);
  }

  async function loadOlder() {
    const first = messages.find((m) => !m.pending);
    if (!first) return;
    const res = await fetch(`/api/app/chat/${userId}?before=${first.id}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const data: { messages: Message[]; hasMore: boolean } = await res.json();
    const el = listRef.current;
    keepFromBottom.current = el ? el.scrollHeight - el.scrollTop : null;
    setHasMore(data.hasMore);
    setMessages((prev) => merge(prev, data.messages));
  }

  async function send(value: string, retryId?: string) {
    const body = value.trim();
    if (!body) return;
    const temp: Message = {
      id: retryId ?? `tmp-${++tempSeq}`,
      text: body,
      mine: true,
      at: new Date().toISOString(),
      pending: true,
    };
    stick.current = true;
    setMessages((prev) => [...prev.filter((m) => m.id !== temp.id), temp]);
    const res = await fetch(`/api/app/chat/${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: body }),
    }).catch(() => null);
    if (!res?.ok) {
      const failed = await errorOf(res, "Илгээгдсэнгүй");
      setMessages((prev) => prev.map((m) => (m.id === temp.id ? { ...m, failed } : m)));
      return;
    }
    const { message }: { message: Message } = await res.json();
    setMessages((prev) => {
      const rest = prev.filter((m) => m.id !== temp.id);
      return rest.some((m) => m.id === message.id) ? rest : merge(rest, [message]);
    });
  }

  function submit(e?: { preventDefault(): void }) {
    e?.preventDefault();
    if (!text.trim()) return;
    send(text);
    setText("");
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Компьютер дээр Enter — илгээх, Shift+Enter — шинэ мөр. Утсан дээр Enter шинэ мөр хийж, товчоор илгээнэ.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
      submit(e);
    }
  }

  const lastConfirmed = [...messages].reverse().find((m) => !m.pending);
  const showStatus = Boolean(lastConfirmed?.mine) && messages[messages.length - 1]?.id === lastConfirmed?.id;
  const seen = Boolean(showStatus && thread?.readAt && lastConfirmed && new Date(thread.readAt) >= new Date(lastConfirmed.at));

  return (
    <div
      className="fixed inset-x-0 z-50 flex flex-col bg-background"
      style={box ? { top: box.top, height: box.height } : { top: 0, height: "100dvh" }}
      role="dialog"
      aria-label={thread ? fullName(thread.person) : "Чат"}
    >
      <header className="shrink-0 border-b border-border bg-background" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex max-w-md items-center gap-2 px-2 py-2">
          <button
            onClick={onBack}
            aria-label="Буцах"
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-foreground active:bg-muted"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          {thread ? (
            <>
              <Avatar person={thread.person} size={40} online={thread.online} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{fullName(thread.person)}</p>
                <p className={`truncate text-xs ${thread.online ? "text-green-500" : "text-muted-foreground"}`}>
                  {presenceText(thread.online, thread.lastSeenAt) || thread.person.position}
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{error || "Ачааллаж байна..."}</p>
          )}
        </div>
      </header>

      <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-md space-y-0.5 px-3 py-3">
          {hasMore && (
            <button
              onClick={loadOlder}
              className="mx-auto mb-2 block rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
            >
              Өмнөх зурвасууд
            </button>
          )}
          {thread && messages.length === 0 && (
            <div className="space-y-2 py-16 text-center">
              <div className="flex justify-center">
                <Avatar person={thread.person} size={72} />
              </div>
              <p className="font-semibold text-foreground">{fullName(thread.person)}</p>
              {thread.person.position && <p className="text-sm text-muted-foreground">{thread.person.position}</p>}
              <p className="pt-2 text-sm text-muted-foreground">
                {thread.canMessage ? "Зурвас бичиж чатаа эхлүүлнэ үү." : "Энэ хүн чат ашиглах боломжгүй болсон."}
              </p>
            </div>
          )}
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const newDay = !prev || !sameDay(prev.at, m.at);
            const grouped = Boolean(prev) && !newDay && prev.mine === m.mine;
            return (
              <Fragment key={m.id}>
                {newDay && <p className="py-2 text-center text-[11px] font-semibold text-muted-foreground">{chatDay(m.at)}</p>}
                <div className={`flex ${m.mine ? "justify-end" : "justify-start"} ${grouped ? "" : "pt-1.5"}`}>
                  <div
                    className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-1.5 text-[15px] leading-snug [overflow-wrap:anywhere] ${
                      m.mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted text-foreground"
                    } ${m.pending ? "opacity-60" : ""}`}
                  >
                    {m.text}
                    <span
                      className={`mt-1 block text-right text-[10px] leading-none ${m.mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                    >
                      {m.pending && !m.failed ? "Илгээж байна…" : chatTime(m.at)}
                    </span>
                  </div>
                </div>
                {m.failed && (
                  <button onClick={() => send(m.text, m.id)} className="ml-auto block pt-0.5 text-[11px] text-red-400">
                    {m.failed} — дахин оролдох
                  </button>
                )}
              </Fragment>
            );
          })}
          {showStatus && <p className="pr-1 pt-0.5 text-right text-[11px] text-muted-foreground">{seen ? "Уншсан" : "Илгээсэн"}</p>}
        </div>
      </div>

      {newBelow && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-lg"
        >
          <ArrowDown className="size-3.5" aria-hidden /> Шинэ зурвас
        </button>
      )}

      {thread && !thread.canMessage ? (
        <p
          className="shrink-0 border-t border-border px-3 pt-3 text-center text-sm text-muted-foreground"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          Энэ хүнд зурвас илгээх боломжгүй.
        </p>
      ) : (
        <form
          onSubmit={submit}
          className="shrink-0 border-t border-border bg-background"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="mx-auto flex max-w-md items-end gap-2 px-2 py-2">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={CHAT_LIMITS.text}
              placeholder="Зурвас бичих..."
              aria-label="Зурвас"
              className="min-h-10 flex-1 resize-none rounded-2xl border border-border bg-muted/40 px-3.5 py-2 text-base leading-snug text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              aria-label="Илгээх"
              // Товч дарахад бичих талбараас фокус гарч гар хаагдахгүй
              onMouseDown={(e) => e.preventDefault()}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
            >
              <SendHorizontal className="size-5" aria-hidden />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
