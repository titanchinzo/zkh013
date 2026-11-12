"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  Copy,
  Download,
  File as FileIcon,
  Lock,
  Paperclip,
  Play,
  Search,
  SendHorizontal,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { Avatar } from "@/components/app/avatar";
import {
  CHAT_FILE,
  CHAT_LIMITS,
  POLL_MS,
  chatDay,
  chatListTime,
  chatTime,
  expiresAt,
  formatBytes,
  presenceText,
  previewText,
  sameDay,
  CHAT_INLINE,
  inlineMedia,
} from "@/lib/chat-shared";
import { usePolling } from "@/lib/use-polling";
import {
  clearChatHistory,
  deleteFileBlobs,
  historyOwner,
  loadFileBlob,
  loadThread,
  loadThreads,
  pruneFileBlobs,
  saveFileBlob,
  saveThread,
  type StoredMessage,
  type StoredPerson,
  type StoredThread,
} from "@/lib/chat-store";

// Утсан дээрх аппын чат: апп ашиглаж буй алба хаагчдын жагсаалт (хэн идэвхтэй), хоёр хүний чат.
// Сервер зөвхөн хараахан уншаагүй зурвасыг түр хадгална: утас зурвасыг хүлээн авч өөртөө хадгалаад серверээс
// устгуулна. Тиймээс чатын түүх зөвхөн хоёр хүний утсанд (lib/chat-store.ts) үлдэнэ.

type LastMessage = { text: string; mine: boolean; at: string };
type ServerPerson = StoredPerson & {
  online: boolean;
  lastSeenAt: string | null;
  canMessage: boolean;
  pending: { count: number; text: string; at: string } | null;
};
type ChatRowData = ServerPerson & { lastMessage: LastMessage | null; unread: number };
// progress — илгээж буй файлын хувь (0–1)
type Message = StoredMessage & { pending?: boolean; failed?: string; progress?: number };
type ThreadInfo = { person: StoredPerson; online: boolean; lastSeenAt: string | null; canMessage: boolean };
type ThreadResponse = ThreadInfo & {
  me: string;
  messages: Message[];
  unreadFrom: string | null;
  readUpTo: { id: string; at: string } | null;
  files: { id: string; status: "ready" | "downloaded" }[];
  removed: string[];
};
// Илгээгч нь «хоёулангаас устгасан» зурвас
type Removed = { sender: string; id: string };

const fullName = (p: { rank: string; name: string }) => (p.rank ? `${p.rank} ${p.name}` : p.name);
const OFFLINE = "Сервертэй холбогдож чадсангүй";

async function errorOf(res: Response | null, fallback: string) {
  return (await res?.json().catch(() => null))?.error ?? fallback;
}

// Чатаас буцаж ороход жагсаалт шууд харагдана (дараа нь шинэчилнэ)
let listCache: ChatRowData[] | null = null;
// Илгээж буй зурвасын түр id
let tempSeq = 0;

/** «Уншаад 2 минутад устах» зурвасын хугацаа дуусаагүй эсэх */
const alive = (m: StoredMessage, now = Date.now()) => (expiresAt(m) ?? Infinity) > now;

/** Утсан дээрх сүүлийн зурвас (хугацаа нь дууссан нууц зурвасыг тооцохгүй) */
const lastOf = (thread?: StoredThread) => {
  const kept = (thread?.messages ?? []).filter((m) => alive(m));
  return kept.length ? kept[kept.length - 1] : null;
};

/** Утсан дээрх түүхээс арилгасан (илгээгч нь устгасан) зурвасуудыг серверт мэдэгдэнэ — тэмдэглэл нь устна */
function confirmRemoved(ids: string[]) {
  if (!ids.length) return;
  fetch("/api/app/chat/removed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  }).catch(() => {});
}

/** Илгээгч нь «хоёулангаас устгасан» зурвасуудыг утсан дээрх чатын түүхээс арилгана (зөвхөн тэр хүнээс ирснийг) */
async function dropRemoved(me: string, threads: StoredThread[], removed: Removed[]): Promise<StoredThread[]> {
  if (!removed.length) return threads;
  const bySender = new Map<string, Set<string>>();
  for (const r of removed) bySender.set(r.sender, (bySender.get(r.sender) ?? new Set()).add(r.id));
  const next = await Promise.all(
    threads.map(async (t) => {
      const ids = bySender.get(t.person.userId);
      const kept = ids ? t.messages.filter((m) => m.mine || !ids.has(m.id)) : t.messages;
      if (kept.length === t.messages.length) return t;
      await saveThread(me, t.person, kept, t.ack);
      return { ...t, messages: kept };
    })
  );
  confirmRemoved(removed.map((r) => r.id));
  return next;
}

/** Серверийн жагсаалт (хүмүүс, уншаагүй зурвас) + утсан дээрх чатын түүх → мөрүүд, сүүлд чатласан нь эхэндээ */
function toRows(people: ServerPerson[], threads: StoredThread[]): ChatRowData[] {
  const threadOf = new Map(threads.map((t) => [t.person.userId, t]));
  const rows: ChatRowData[] = people.map((p) => {
    const local = lastOf(threadOf.get(p.userId));
    threadOf.delete(p.userId);
    const waiting = p.pending ? { text: p.pending.text, mine: false, at: p.pending.at } : null;
    const lastMessage =
      local && (!waiting || new Date(local.at) >= new Date(waiting.at)) ? { text: previewText(local), mine: local.mine, at: local.at } : waiting;
    return { ...p, lastMessage, unread: p.pending?.count ?? 0 };
  });
  // Сервер дээр байхгүй болсон (халагдсан, хасагдсан) хүнтэй хийсэн өмнөх чат — зөвхөн уншина
  for (const t of threadOf.values()) {
    const local = lastOf(t);
    if (!local) continue;
    rows.push({
      ...t.person,
      online: false,
      lastSeenAt: null,
      canMessage: false,
      pending: null,
      lastMessage: { text: previewText(local), mine: local.mine, at: local.at },
      unread: 0,
    });
  }
  const time = (r: ChatRowData) => (r.lastMessage ? new Date(r.lastMessage.at).getTime() : 0);
  return rows.sort(
    (a, b) => time(b) - time(a) || Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, "mn")
  );
}

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
  const [rows, setRows] = useState<ChatRowData[] | null>(listCache);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/app/chat", { cache: "no-store" }).catch(() => null);
    if (res?.status === 403) {
      // Утсыг хүчингүй болгосон эсвэл бүртгэл идэвхгүй болсон — утсан дээрх түүхийг арилгана
      await clearChatHistory();
      listCache = null;
      setRows([]);
      setError(await errorOf(res, "Энэ утсаар чат ашиглах эрхгүй байна"));
      return;
    }
    if (!res?.ok) {
      setError(await errorOf(res, OFFLINE));
      return;
    }
    const data: { me: string; unreadTotal: number; people: ServerPerson[]; removed?: Removed[] } = await res.json();
    const threads = await dropRemoved(data.me, await loadThreads(data.me), data.removed ?? []);
    const next = toRows(data.people, threads);
    pruneFileBlobs(
      new Set(threads.flatMap((t) => t.messages.filter((m) => m.file && alive(m)).map((m) => m.file!.id)))
    );
    listCache = next;
    setError("");
    setRows(next);
    onUnread(data.unreadTotal);
  }, [onUnread]);

  useEffect(() => {
    // Сервер хариулахаас өмнө (сүлжээгүй үед ч) утсан дээрх чатуудыг харуулна
    const owner = historyOwner();
    if (!listCache && owner) loadThreads(owner).then((threads) => setRows((current) => current ?? toRows([], threads)));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);
  usePolling(load, POLL_MS.list);

  if (!rows) return <p className="text-sm text-muted-foreground">{error || "Ачааллаж байна..."}</p>;

  const q = query.trim().toLowerCase();
  const shown = q ? rows.filter((p) => `${p.rank} ${p.name} ${p.position}`.toLowerCase().includes(q)) : rows;
  const active = rows.filter((p) => p.online && p.canMessage);

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
        !error && <p className="text-sm text-muted-foreground">{q ? "Олдсонгүй." : "Апп ашиглаж буй өөр хүн одоогоор алга."}</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {shown.map((p) => (
            <ChatRow key={p.userId} person={p} onOpen={onOpen} />
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Зурвас хүлээн авагч уншмагц серверээс устна; чатын түүх зөвхөн та хоёрын утсанд хадгалагдана. Албаны нууцад
        хамаарах мэдээллийг чатаар бичихгүй.
      </p>
    </section>
  );
}

function ChatRow({ person: p, onOpen }: { person: ChatRowData; onOpen: (userId: string) => void }) {
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

/** Зурвасуудыг нэгтгэнэ: давхардлыг хасаж, үүссэн дарааллаар (MongoDB id), илгээж буй зурвас төгсгөлд */
function merge(current: Message[], incoming: Message[]): Message[] {
  const known = new Set(current.map((m) => m.id));
  const confirmed = current.filter((m) => !m.pending);
  for (const m of incoming) {
    if (known.has(m.id)) continue;
    known.add(m.id);
    confirmed.push(m);
  }
  confirmed.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return [...confirmed, ...current.filter((m) => m.pending)];
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

type Local = { me: string | null; person: StoredPerson | null; messages: Message[]; ack: string | null };
type UploadJob = { file: File; fileId: string; uploadId: string; chunkSize: number };

const EPHEMERAL_KEY = "zkh013-chat-ephemeral:";

/** 95000 → "1:35" */
const countdown = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

/**
 * Чат дотор харагдах зураг, бичлэг. Утсан дээр хадгалсан бол шууд; хүлээн авагчид — жижиг зургийг өөрөө, бусдыг
 * «Үзэх» дарж серверээс нэг удаа татаад (сервер татагдмагц устгана) утсандаа хадгална. Харуулж чадахгүй бол fallback.
 */
function MediaBubble({
  message: m,
  me,
  onView,
  fallback,
}: {
  message: Message;
  me: string | null;
  onView: (image: { url: string; name: string }) => void;
  fallback: React.ReactNode;
}) {
  const file = m.file!;
  const kind = inlineMedia(file)!;
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"checking" | "missing" | "loading" | "ready" | "failed" | "broken">("checking");
  const [progress, setProgress] = useState(0);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    loadFileBlob(file.id).then((blob) => {
      if (!live) return;
      if (blob) {
        urlRef.current = URL.createObjectURL(blob);
        setUrl(urlRef.current);
        setState("ready");
      } else setState("missing");
    });
    return () => {
      live = false;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [file.id]);

  const fetchable = !m.mine && m.fileStatus !== "downloaded" && m.fileStatus !== "gone";

  const fetchNow = useCallback(async () => {
    setState("loading");
    const res = await fetch(`/api/app/chat/files/${file.id}`).catch(() => null);
    if (!res?.ok || !res.body) {
      setState("failed");
      return;
    }
    const reader = res.body.getReader();
    const chunks: BlobPart[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }));
      if (done || !value) break;
      chunks.push(value);
      received += value.length;
      setProgress(received / file.size);
    }
    if (received !== file.size) {
      setState("failed");
      return;
    }
    const blob = new Blob(chunks, { type: file.type });
    if (me) await saveFileBlob(me, file.id, blob);
    urlRef.current = URL.createObjectURL(blob);
    setUrl(urlRef.current);
    setState("ready");
  }, [file.id, file.size, file.type, me]);

  // Жижиг зургийг чатыг нээхэд өөрөө ачаална
  useEffect(() => {
    if (state === "missing" && fetchable && kind === "image" && file.size <= CHAT_INLINE.autoImage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- start loading a small image once it is known to be missing
      fetchNow();
    }
  }, [state, fetchable, kind, file.size, fetchNow]);

  if (state === "ready" && url) {
    return (
      <span className="-mx-1.5 mb-1 block">
        {kind === "image" ? (
          <button type="button" onClick={() => onView({ url, name: file.name })} className="block" aria-label={`${file.name} томоор харах`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL from the phone's own storage */}
            <img
              src={url}
              alt={file.name}
              onError={() => setState("broken")}
              className="max-h-80 w-auto max-w-full rounded-xl object-contain"
            />
          </button>
        ) : (
          <video src={url} controls playsInline preload="metadata" className="max-h-80 w-full rounded-xl bg-black" />
        )}
        <a href={url} download={file.name} className="mt-1 inline-block text-[11px] underline opacity-80">
          Хадгалах
        </a>
      </span>
    );
  }
  if (state === "broken" && url) {
    return (
      <span className="mb-1 block text-sm">
        {file.name} — энэ утас харуулж чадсангүй.{" "}
        <a href={url} download={file.name} className="underline">
          Хадгалах
        </a>
      </span>
    );
  }
  if (state === "loading" || (state === "missing" && fetchable)) {
    return (
      <span className="mb-1 flex min-w-[200px] items-center gap-2.5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-black/15">
          <Play className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{kind === "image" ? "Зураг" : "Бичлэг"}</span>
          <span className="block text-xs opacity-80">
            {formatBytes(file.size)}
            {state === "loading" ? ` · Ачаалж байна… ${Math.round(progress * 100)}%` : " · Нэг удаа татна — дараа нь серверээс устна"}
          </span>
        </span>
        {state === "missing" && (
          <button
            type="button"
            onClick={fetchNow}
            className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            Үзэх
          </button>
        )}
      </span>
    );
  }
  if (state === "checking") return <span className="mb-1 block h-24 w-48 animate-pulse rounded-xl bg-black/10" />;
  return (
    <>
      {state === "failed" && <span className="mb-1 block text-xs text-red-400">Ачаалж чадсангүй — дахин оролдоно уу</span>}
      {fallback}
    </>
  );
}

/** Чатын файл: илгээж буй явц, хүлээн авагчид «Татах» (татаж авмагц серверээс устна), төлөв */
function FileCard({ message: m, downloading, onDownload }: { message: Message; downloading: boolean; onDownload: () => void }) {
  const file = m.file!;
  const status = m.fileStatus ?? "ready";
  const note = m.pending
    ? m.failed
      ? "Илгээгдсэнгүй"
      : `Илгээж байна… ${Math.round((m.progress ?? 0) * 100)}%`
    : status === "downloaded"
      ? m.mine
        ? "✓ Татаж авсан"
        : "Татаж авсан — серверээс устсан"
      : status === "gone"
        ? "Серверээс устсан"
        : m.mine
          ? "Хүлээн авагч татаагүй"
          : downloading
            ? "Татаж байна… дуусмагц серверээс устна"
            : "Нэг удаа татна — дараа нь серверээс устна";
  return (
    <span className="mb-1 flex min-w-[200px] items-center gap-2.5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-black/15">
        <FileIcon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{file.name}</span>
        <span className="block text-xs opacity-80">
          {formatBytes(file.size)} · {note}
        </span>
        {m.pending && !m.failed && (
          <span className="mt-1 block h-1 overflow-hidden rounded-full bg-black/20">
            <span className="block h-full bg-current" style={{ width: `${Math.round((m.progress ?? 0) * 100)}%` }} />
          </span>
        )}
      </span>
      {!m.mine && !m.pending && status === "ready" && !downloading && (
        <a
          href={`/api/app/chat/files/${file.id}`}
          download={file.name}
          onClick={onDownload}
          aria-label={`${file.name} татах`}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          <Download className="size-4" aria-hidden />
        </a>
      )}
    </span>
  );
}

/** Хоёр хүний чат — бүтэн дэлгэцээр */
export function Conversation({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [info, setInfo] = useState<ThreadInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);
  const [text, setText] = useState("");
  const [newBelow, setNewBelow] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Хамгийн доор байгаа эсэх, дараагийн зурагт доош гүйлгэх эсэх
  const atBottom = useRef(true);
  const stick = useRef(true);
  const box = useVisualViewport();

  // Утсан дээрх түүх (энд л үлдэнэ). ack — хүлээн авч хадгалсан сүүлийн зурвас: дараагийн асуулгаар сервер түүнийг
  // хүртэлх зурвасыг устгана. verified — серверээс энэ утасны эзнийг баталсны дараа л ack илгээнэ.
  const local = useRef<Local>({ me: null, person: null, messages: [], ack: null });
  const verified = useRef(false);
  const ready = useRef(false);
  const busy = useRef(false);
  const again = useRef(false);
  // Асуулга бүрийн дугаар; илгээсэн зурвас аль асуулгын үед баталгаажсан — асуулга эхлэхээс өмнө илгээгдсэнийг л уншсан эсэхийг шалгана
  const tick = useRef(0);
  const confirmedAt = useRef(new Map<string, number>());
  // Илгээж буй файлууд (түр id → файл, оруулалт) — тасарвал үргэлжлүүлэхэд
  const uploads = useRef(new Map<string, UploadJob>());
  const picked = useRef(new Map<string, File>());
  // «Уншаад 2 минутад устах» горим (энэ хүнтэй чатад, утсан дээр хадгална)
  const [ephemeral, setEphemeral] = useState(false);
  // Нууц зурвасын үлдсэн хугацааг секунд тутам шинэчилнэ
  const [now, setNow] = useState(0);
  // Татаж эхэлсэн файлууд — дуусахад сервер «татаж авсан» гэж тэмдэглэнэ
  const [downloading, setDownloading] = useState<Set<string>>(() => new Set());
  const [viewer, setViewer] = useState<{ url: string; name: string } | null>(null);
  // Энэ утасны эзэн (серверээс баталсан) — зураг, бичлэгийг утсанд хадгалахад
  const [me, setMe] = useState<string | null>(null);
  // Зурвас дээр удаан дарахад (компьютер дээр баруун товч) гарах цэс: хуулах, устгах
  const [menu, setMenu] = useState<Message | null>(null);
  const press = useRef<{ timer: number; x: number; y: number; fired: boolean } | null>(null);
  const backdropDown = useRef(false);
  // Богино мэдэгдэл («Хуулсан» г.м)
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef(0);
  // Чатаас алга болсон (нууц зурвасын хугацаа дууссан) зурвасын зураг, бичлэгийг утаснаас устгана
  const shownFiles = useRef(new Set<string>());
  useEffect(() => {
    const now = new Set(messages.flatMap((m) => (m.file?.id ? [m.file.id] : [])));
    const gone = [...shownFiles.current].filter((id) => !now.has(id));
    if (gone.length) deleteFileBlobs(gone);
    shownFiles.current = now;
  }, [messages]);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- per-chat setting stored on this phone
      setEphemeral(localStorage.getItem(`${EPHEMERAL_KEY}${userId}`) === "1");
    } catch {}
  }, [userId]);

  const show = useCallback((next: Message[]) => {
    local.current.messages = next;
    setMessages(next);
  }, []);

  const persist = useCallback(async () => {
    const { me, person, messages: all, ack } = local.current;
    if (!me || !person) return;
    const saved = all
      .filter((m) => !m.pending)
      .map(({ id, text, mine, at, read, file, fileStatus, ephemeral, readAt }) => ({
        id,
        text,
        mine,
        at,
        read,
        file,
        fileStatus,
        ephemeral,
        readAt,
      }));
    await saveThread(me, person, saved, ack);
  }, []);

  useEffect(() => {
    if (!messages.some((m) => m.ephemeral && m.readAt)) return;
    const timer = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      const kept = local.current.messages.filter((m) => alive(m, t));
      if (kept.length !== local.current.messages.length) {
        show(kept);
        persist();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [messages, show, persist]);

  const lose = useCallback(
    async (res: Response) => {
      // Утсыг хүчингүй болгосон эсвэл бүртгэл идэвхгүй болсон — утсан дээрх түүхийг арилгана
      await clearChatHistory();
      local.current = { me: null, person: null, messages: [], ack: null };
      show([]);
      setInfo(null);
      setError(await errorOf(res, "Энэ утсаар чат ашиглах эрхгүй байна"));
    },
    [show]
  );

  /** Серверээс шинэ зурвас авч хадгална; шинэ зурвас ирсэн бол true (тэгвэл шууд дахин асууж серверээс устгуулна) */
  const pollOnce = useCallback(async (): Promise<boolean> => {
    const startedAt = ++tick.current;
    const ack = verified.current ? local.current.ack : null;
    const res = await fetch(`/api/app/chat/${userId}${ack ? `?ack=${ack}` : ""}`, { cache: "no-store" }).catch(() => null);
    if (!res) {
      setError(OFFLINE);
      return false;
    }
    if (res.status === 403) {
      await lose(res);
      return false;
    }
    if (res.status === 404) {
      setMissing(true);
      setError("");
      return false;
    }
    if (!res.ok) {
      setError(await errorOf(res, OFFLINE));
      return false;
    }
    const data: ThreadResponse = await res.json();
    setError("");
    const first = !verified.current;
    if (local.current.me !== data.me) {
      // Энэ утсаар өөр хүн нэвтэрсэн бол өмнөх хүний түүхийг харуулахгүй (loadThread түүнийг арилгана)
      const kept = local.current.me === null ? local.current.messages : [];
      const stored = await loadThread(data.me, userId);
      local.current = { me: data.me, person: data.person, messages: merge(stored?.messages ?? [], kept), ack: stored?.ack ?? null };
    }
    verified.current = true;
    setMe(data.me);
    local.current.person = data.person;
    setInfo({ person: data.person, online: data.online, lastSeenAt: data.lastSeenAt, canMessage: data.canMessage });

    const before = local.current.messages;
    const fresh = data.messages.filter((m) => !before.some((k) => k.id === m.id));
    let changed = first || data.messages.length > 0;
    const now = Date.now();
    const statusOf = new Map(data.files.map((x) => [x.id, x.status]));
    // Нөгөө хүн «хоёулангаас устгасан» зурвасууд (зөвхөн түүнээс ирснийг арилгана)
    const removedIds = data.removed ?? [];
    const removed = new Set(removedIds);
    const merged = merge(before, data.messages);
    const next = merged
      .map((m) => {
        let n = m;
        // Миний илгээснээс unreadFrom-оос өмнөх нь уншигдсан (асуулга эхлэхээс өмнө илгээгдсэн нь л)
        if (
          n.mine &&
          !n.pending &&
          !n.read &&
          (confirmedAt.current.get(n.id) ?? 0) < startedAt &&
          !(data.unreadFrom && n.id >= data.unreadFrom)
        ) {
          n = { ...n, read: true };
        }
        // Нууц зурвас: ирснийг одоо уншиж байна; илгээснийг нөгөө хүн уншсан цагаас 2 минут тоолно
        if (n.ephemeral && !n.readAt && !n.pending) {
          if (!n.mine) n = { ...n, readAt: now };
          else if (data.readUpTo && n.id <= data.readUpTo.id) n = { ...n, readAt: Date.parse(data.readUpTo.at) };
        }
        // Файл: серверт байгаа эсэх (татаж авмагц устдаг)
        if (n.file && !n.pending) {
          const status = statusOf.get(n.file.id) ?? "gone";
          if (status !== n.fileStatus) n = { ...n, fileStatus: status };
        }
        if (n !== m) changed = true;
        return n;
      })
      .filter((m) => alive(m, now) && (m.mine || !removed.has(m.id)));
    if (next.length !== merged.length) changed = true;
    if (!changed) {
      confirmRemoved(removedIds);
      return false;
    }
    if (fresh.length) {
      if (atBottom.current) stick.current = true;
      else setNewBelow(true);
    }
    local.current.messages = next;
    if (data.messages.length) local.current.ack = data.messages[data.messages.length - 1].id;
    await persist();
    confirmRemoved(removedIds);
    setMessages(next);
    // Шинээр хадгалсан зурвас байвал шууд дахин асууж (ack) серверээс устгуулна
    return data.messages.length > 0 && local.current.ack !== ack;
  }, [userId, lose, persist]);

  const poll = useCallback(async () => {
    if (!ready.current) return;
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    try {
      let more = true;
      while (more) {
        again.current = false;
        more = (await pollOnce()) || again.current;
      }
    } finally {
      busy.current = false;
    }
  }, [pollOnce]);

  // Эхлээд утсан дээрх түүхийг харуулж, дараа нь серверээс шинэ зурвас авна
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const owner = historyOwner();
      const stored = owner ? await loadThread(owner, userId) : undefined;
      if (cancelled) return;
      const kept = (stored?.messages ?? []).filter((m) => alive(m));
      local.current = { me: owner, person: stored?.person ?? null, messages: kept, ack: stored?.ack ?? null };
      setMe(owner);
      if (stored) {
        setInfo((current) => current ?? { person: stored.person, online: false, lastSeenAt: null, canMessage: true });
        setMessages(kept);
      }
      ready.current = true;
      poll();
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, poll]);
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
    if (el && stick.current) {
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

  async function send(value: string, retryId?: string) {
    const body = value.trim();
    if (!body) return;
    const temp: Message = {
      id: retryId ?? `tmp-${++tempSeq}`,
      text: body,
      mine: true,
      at: new Date().toISOString(),
      pending: true,
      ...(ephemeral ? { ephemeral: true } : {}),
    };
    stick.current = true;
    show([...local.current.messages.filter((m) => m.id !== temp.id), temp]);
    const res = await fetch(`/api/app/chat/${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: body, ephemeral: temp.ephemeral === true }),
    }).catch(() => null);
    if (res?.status === 403) {
      await lose(res);
      return;
    }
    if (!res?.ok) {
      const failed = await errorOf(res, "Илгээгдсэнгүй");
      show(local.current.messages.map((m) => (m.id === temp.id ? { ...m, failed } : m)));
      return;
    }
    const { message }: { message: Message } = await res.json();
    confirmedAt.current.set(message.id, tick.current);
    show(merge(local.current.messages.filter((m) => m.id !== temp.id), [message]));
    await persist();
  }

  /** Файлыг 4MB-аар хэсэгчлэн оруулна; тасарвал серверт ирсэн газраас нь үргэлжилнэ */
  async function uploadChunks(job: UploadJob, tempId: string) {
    let offset = 0;
    while (offset < job.file.size) {
      const chunk = job.file.slice(offset, Math.min(offset + job.chunkSize, job.file.size));
      let res: Response | null = null;
      for (let attempt = 1; attempt <= 3 && !res; attempt++) {
        res = await fetch(`/api/uploads/${job.uploadId}?offset=${offset}`, { method: "PUT", body: chunk }).catch(() => null);
        if (!res) await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
      if (!res) throw new Error(OFFLINE);
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && typeof data.received === "number") {
        offset = data.received;
        continue;
      }
      if (!res.ok) throw new Error(data.error ?? "Файл илгээж чадсангүй");
      offset = data.received;
      const progress = offset / job.file.size;
      show(local.current.messages.map((m) => (m.id === tempId ? { ...m, progress } : m)));
    }
  }

  /** Файл илгээх: эхлүүлэх → хэсэгчлэн оруулах → зурвас болгон илгээх. Тасарвал «дахин оролдох» нь үргэлжлүүлнэ. */
  async function sendFile(file: File, retryId?: string) {
    if (file.size > CHAT_FILE.maxBytes) {
      setError(`Файлын хэмжээ ${formatBytes(CHAT_FILE.maxBytes)}-аас ихгүй байна`);
      return;
    }
    const id = retryId ?? `tmp-${++tempSeq}`;
    picked.current.set(id, file);
    const previous = local.current.messages.find((m) => m.id === id);
    const temp: Message = {
      id,
      text: "",
      mine: true,
      at: previous?.at ?? new Date().toISOString(),
      pending: true,
      progress: previous?.progress ?? 0,
      file: { id: "", name: file.name, size: file.size, type: file.type },
      ...((previous ? previous.ephemeral : ephemeral) ? { ephemeral: true } : {}),
    };
    stick.current = true;
    show([...local.current.messages.filter((m) => m.id !== id), temp]);
    const fail = (failed: string) => show(local.current.messages.map((m) => (m.id === id ? { ...m, failed } : m)));
    try {
      let job = uploads.current.get(id);
      if (!job) {
        const start = await fetch(`/api/app/chat/${userId}/files`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, size: file.size, type: file.type }),
        }).catch(() => null);
        if (!start?.ok) return fail(await errorOf(start, OFFLINE));
        const started = await start.json();
        job = { file, fileId: started.fileId, uploadId: started.uploadId, chunkSize: started.chunkSize };
        uploads.current.set(id, job);
      }
      await uploadChunks(job, id);
      const res = await fetch(`/api/app/chat/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: job.fileId, ephemeral: temp.ephemeral === true }),
      }).catch(() => null);
      if (res?.status === 403) return lose(res);
      if (!res?.ok) return fail(await errorOf(res, "Илгээгдсэнгүй"));
      uploads.current.delete(id);
      picked.current.delete(id);
      const { message }: { message: Message } = await res.json();
      confirmedAt.current.set(message.id, tick.current);
      if (local.current.me && message.file && inlineMedia(message.file)) {
        await saveFileBlob(local.current.me, message.file.id, file);
      }
      show(merge(local.current.messages.filter((m) => m.id !== id), [{ ...message, fileStatus: "ready" }]));
      await persist();
    } catch (err) {
      fail(err instanceof Error ? err.message : "Файл илгээж чадсангүй");
    }
  }

  /** Тасарсан файлыг үргэлжлүүлэн илгээнэ (серверт ирсэн хэсгээс нь) */
  function retryFile(id: string) {
    const file = picked.current.get(id);
    if (file) sendFile(file, id);
    else show(local.current.messages.filter((m) => m.id !== id));
  }

  function pickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    for (const file of files) sendFile(file);
  }

  function toggleEphemeral() {
    const next = !ephemeral;
    setEphemeral(next);
    try {
      if (next) localStorage.setItem(`${EPHEMERAL_KEY}${userId}`, "1");
      else localStorage.removeItem(`${EPHEMERAL_KEY}${userId}`);
    } catch {}
  }

  function flash(value: string) {
    setNotice(value);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 3000);
  }

  function openMenu(m: Message) {
    if (m.pending && !m.failed) return; // илгээгдэж байна
    backdropDown.current = false;
    setMenu(m);
  }

  // Утсан дээр: 0.5 секунд дарж байвал цэс гарна (гүйлгэж эхэлбэл болино). Компьютер дээр баруун товч.
  function pressStart(e: React.PointerEvent, m: Message) {
    if (e.pointerType === "mouse") {
      press.current = null;
      return;
    }
    const current = { timer: 0, x: e.clientX, y: e.clientY, fired: false };
    current.timer = window.setTimeout(() => {
      current.fired = true;
      navigator.vibrate?.(15);
      openMenu(m);
    }, 500);
    press.current = current;
  }

  function pressMove(e: React.PointerEvent) {
    const p = press.current;
    if (p && !p.fired && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) window.clearTimeout(p.timer);
  }

  function pressEnd() {
    if (press.current) window.clearTimeout(press.current.timer);
  }

  function onContextMenu(e: React.MouseEvent, m: Message) {
    // Компьютер дээр текстийн хэсгийг сонгосон бол хөтчийн өөрийн цэс (хуулах) гарна
    if (window.getSelection()?.toString()) return;
    e.preventDefault();
    if (press.current) {
      window.clearTimeout(press.current.timer);
      press.current.fired = true;
    }
    openMenu(m);
  }

  // Удаан дарсны дараах товшилт зургийг томруулах, файл татах үйлдлийг ажиллуулахгүй
  function afterPress(e: React.MouseEvent) {
    if (!press.current?.fired) return;
    e.preventDefault();
    e.stopPropagation();
    press.current = null;
  }

  /** Зурвасыг энэ утаснаас арилгана (зураг, бичлэг нь утаснаас мөн устна) */
  async function removeLocal(id: string) {
    uploads.current.delete(id);
    picked.current.delete(id);
    show(local.current.messages.filter((m) => m.id !== id));
    await persist();
  }

  /** «Хоёулангаас устгах»: миний илгээсэн зурвасыг серверээс, нөгөө хүний утаснаас устгана */
  async function unsend(m: Message) {
    setMenu(null);
    const res = await fetch(`/api/app/chat/${userId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id, fileId: m.file?.id || undefined }),
    }).catch(() => null);
    if (res?.status === 403) return lose(res);
    if (!res?.ok) return flash(await errorOf(res, "Устгаж чадсангүй — сүлжээгээ шалгаад дахин оролдоно уу"));
    await removeLocal(m.id);
    flash("Хоёулангаас устгалаа");
  }

  /** «Надаас устгах»: зөвхөн энэ утаснаас. Ирсэн файлыг татаагүй бол серверээс ч устгана (дахин татах боломжгүй). */
  async function removeForMe(m: Message) {
    setMenu(null);
    if (!m.mine && !m.pending && m.file?.id && m.fileStatus !== "downloaded" && m.fileStatus !== "gone") {
      fetch(`/api/app/chat/files/${m.file.id}`, { method: "DELETE" }).catch(() => {});
    }
    await removeLocal(m.id);
  }

  async function copyText(m: Message) {
    setMenu(null);
    try {
      await navigator.clipboard.writeText(m.text);
      flash("Хуулсан");
    } catch {
      flash("Хуулж чадсангүй");
    }
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

  const person = info?.person ?? null;
  const canMessage = Boolean(info?.canMessage) && !missing;
  const last = messages[messages.length - 1];
  const status = last?.mine && !last.pending ? (last.read ? "Уншсан" : "Илгээсэн") : "";

  return (
    <div
      className="fixed inset-x-0 z-50 flex flex-col bg-background"
      style={box ? { top: box.top, height: box.height } : { top: 0, height: "100dvh" }}
      role="dialog"
      aria-label={person ? fullName(person) : "Чат"}
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
          {person ? (
            <>
              <Avatar person={person} size={40} online={missing ? undefined : info?.online} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{fullName(person)}</p>
                <p className={`truncate text-xs ${info?.online && !missing ? "text-green-500" : "text-muted-foreground"}`}>
                  {(!missing && presenceText(Boolean(info?.online), info?.lastSeenAt)) || person.position}
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{error || (missing ? "Хэрэглэгч олдсонгүй" : "Ачааллаж байна...")}</p>
          )}
        </div>
      </header>

      <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-md space-y-0.5 px-3 py-3">
          <p className="mx-auto mb-3 flex max-w-xs items-start justify-center gap-1.5 text-center text-[11px] leading-snug text-muted-foreground">
            <Lock className="mt-px size-3 shrink-0" aria-hidden />
            Зурвас хүлээн авагч уншмагц, файл татаж авмагц серверээс устна. Чатын түүх зөвхөн та хоёрын утсанд
            хадгалагдана. Зурвас дээр удаан дарж устгана.
          </p>
          {person && messages.length === 0 && (
            <div className="space-y-2 py-12 text-center">
              <div className="flex justify-center">
                <Avatar person={person} size={72} />
              </div>
              <p className="font-semibold text-foreground">{fullName(person)}</p>
              {person.position && <p className="text-sm text-muted-foreground">{person.position}</p>}
              <p className="pt-2 text-sm text-muted-foreground">
                {canMessage ? "Зурвас бичиж чатаа эхлүүлнэ үү." : "Энэ хүн чат ашиглах боломжгүй болсон."}
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
                    data-message={m.id}
                    onContextMenu={(e) => onContextMenu(e, m)}
                    onPointerDown={(e) => pressStart(e, m)}
                    onPointerMove={pressMove}
                    onPointerUp={pressEnd}
                    onPointerCancel={pressEnd}
                    onPointerLeave={pressEnd}
                    onClickCapture={afterPress}
                    className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-1.5 text-[15px] leading-snug [overflow-wrap:anywhere] [-webkit-touch-callout:none] pointer-coarse:select-none ${
                      menu?.id === m.id ? "ring-2 ring-primary/60 " : ""
                    }${
                      m.mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted text-foreground"
                    } ${m.pending ? "opacity-60" : ""}`}
                  >
                    {m.file && m.file.id && !m.pending && inlineMedia(m.file) ? (
                      <MediaBubble
                        message={m}
                        me={me}
                        onView={setViewer}
                        fallback={
                          <FileCard
                            message={m}
                            downloading={downloading.has(m.file.id)}
                            onDownload={() => setDownloading((current) => new Set(current).add(m.file!.id))}
                          />
                        }
                      />
                    ) : m.file && (
                      <FileCard
                        message={m}
                        downloading={downloading.has(m.file.id)}
                        onDownload={() => setDownloading((current) => new Set(current).add(m.file!.id))}
                      />
                    )}
                    {m.text}
                    <span
                      className={`mt-1 flex items-center justify-end gap-1 text-[10px] leading-none ${m.mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                    >
                      {m.ephemeral && (
                        <span className="inline-flex items-center gap-0.5" title="Уншсаны дараа 2 минутад устна">
                          <Timer className="size-3" aria-hidden />
                          {m.readAt && now ? countdown(expiresAt(m)! - now) : ""}
                        </span>
                      )}
                      {m.pending && !m.failed ? (m.file ? "" : "Илгээж байна…") : chatTime(m.at)}
                    </span>
                  </div>
                </div>
                {m.failed && (
                  <button
                    onClick={() => (m.file ? retryFile(m.id) : send(m.text, m.id))}
                    className="ml-auto block pt-0.5 text-[11px] text-red-400"
                  >
                    {m.failed} — дахин оролдох
                  </button>
                )}
              </Fragment>
            );
          })}
          {status && <p className="pr-1 pt-0.5 text-right text-[11px] text-muted-foreground">{status}</p>}
          {error && person && <p className="pt-2 text-center text-[11px] text-red-400">{error}</p>}
        </div>
      </div>

      {viewer && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black" role="dialog" aria-label={viewer.name}>
          <div className="flex items-center justify-between gap-2 px-2 py-2" style={{ paddingTop: "env(safe-area-inset-top)" }}>
            <button
              onClick={() => setViewer(null)}
              aria-label="Хаах"
              className="flex size-10 items-center justify-center rounded-full text-white active:bg-white/10"
            >
              <X className="size-6" aria-hidden />
            </button>
            <a href={viewer.url} download={viewer.name} className="rounded-full px-3 py-1.5 text-sm font-semibold text-white active:bg-white/10">
              Хадгалах
            </a>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL from the phone's own storage */}
          <img src={viewer.url} alt={viewer.name} className="min-h-0 flex-1 object-contain" />
        </div>
      )}

      {menu && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50"
          role="dialog"
          aria-label="Зурвасын цэс"
          // Удаан дарж цэс нээсэн хурууг өргөхөд цэс хаагдахгүй — зөвхөн дэвсгэр дээр шинээр дарвал
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) backdropDown.current = true;
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && backdropDown.current) setMenu(null);
          }}
        >
          <div className="w-full max-w-md space-y-2 px-3 pt-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background">
              <p className="truncate px-4 py-2.5 text-center text-xs text-muted-foreground">
                {menu.ephemeral ? "Нууц зурвас" : previewText(menu) || "Зурвас"}
              </p>
              {menu.text && !menu.ephemeral && !menu.pending && (
                <button onClick={() => copyText(menu)} className="flex w-full items-center gap-3 px-4 py-3 text-left text-foreground active:bg-muted">
                  <Copy className="size-5 shrink-0" aria-hidden />
                  Хуулах
                </button>
              )}
              {menu.mine && !menu.pending && (
                <button onClick={() => unsend(menu)} className="flex w-full items-center gap-3 px-4 py-3 text-left text-red-500 active:bg-muted">
                  <Trash2 className="size-5 shrink-0" aria-hidden />
                  <span>
                    <span className="block font-semibold">Хоёулангаас устгах</span>
                    <span className="block text-xs text-muted-foreground">Таны болон хүлээн авагчийн утаснаас устна</span>
                  </span>
                </button>
              )}
              <button onClick={() => removeForMe(menu)} className="flex w-full items-center gap-3 px-4 py-3 text-left text-red-500 active:bg-muted">
                <Trash2 className="size-5 shrink-0" aria-hidden />
                <span>
                  <span className="block font-semibold">{menu.pending ? "Устгах" : "Надаас устгах"}</span>
                  <span className="block text-xs text-muted-foreground">
                    {menu.pending ? "Илгээгдээгүй зурвасыг устгана" : "Зөвхөн энэ утаснаас устна"}
                  </span>
                </span>
              </button>
            </div>
            <button
              onClick={() => setMenu(null)}
              className="w-full rounded-2xl border border-border bg-background py-3 font-semibold text-foreground active:bg-muted"
            >
              Болих
            </button>
          </div>
        </div>
      )}

      {notice && (
        <p
          role="status"
          className="pointer-events-none absolute left-1/2 top-20 -translate-x-1/2 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background shadow-lg"
        >
          {notice}
        </p>
      )}

      {newBelow && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-lg"
        >
          <ArrowDown className="size-3.5" aria-hidden /> Шинэ зурвас
        </button>
      )}

      {person && !canMessage ? (
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
          {ephemeral && (
            <p className="mx-auto flex max-w-md items-center gap-1.5 px-3 pt-2 text-[11px] text-yellow-400">
              <Timer className="size-3.5 shrink-0" aria-hidden />
              Нууц горим: илгээх зурвас, файл уншигдсанаас хойш 2 минутад хоёр утаснаас устна.
            </p>
          )}
          <div className="mx-auto flex max-w-md items-end gap-1 px-2 py-2">
            <label
              className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground active:bg-muted"
              title={`Файл илгээх (${formatBytes(CHAT_FILE.maxBytes)} хүртэл)`}
            >
              <Paperclip className="size-5" aria-hidden />
              <span className="sr-only">Файл илгээх</span>
              <input type="file" multiple onChange={pickFiles} disabled={!person} className="sr-only" />
            </label>
            <button
              type="button"
              onClick={toggleEphemeral}
              onMouseDown={(e) => e.preventDefault()}
              aria-pressed={ephemeral}
              aria-label="Уншаад 2 минутад устах горим"
              className={`flex size-10 shrink-0 items-center justify-center rounded-full active:bg-muted ${
                ephemeral ? "bg-yellow-400/15 text-yellow-400" : "text-muted-foreground"
              }`}
            >
              <Timer className="size-5" aria-hidden />
            </button>
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={CHAT_LIMITS.text}
              placeholder={ephemeral ? "Нууц зурвас..." : "Зурвас бичих..."}
              aria-label="Зурвас"
              className="min-h-10 flex-1 resize-none rounded-2xl border border-border bg-muted/40 px-3.5 py-2 text-base leading-snug text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={!text.trim() || !person}
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
