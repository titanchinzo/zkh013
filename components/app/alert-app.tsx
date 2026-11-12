"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { House, MessageCircle, Newspaper, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { RankSelect } from "@/components/hr/rank-select";
import {
  DUTY_LABEL,
  DUTY_REMINDER_TEXT,
  formatDateTime,
  formatDay,
  formatPhone,
  formatWeek,
  relativeDay,
  todayUb,
} from "@/lib/hr";
import { POLL_MS } from "@/lib/chat-shared";
import { InstallSteps, useInstall } from "@/components/app/install";
import { Avatar } from "@/components/app/avatar";
import { ChatList, Conversation } from "@/components/app/chat";
import { NewsDetail, NewsList, NewsWrite } from "@/components/app/news";
import { Directory } from "@/components/app/directory";
import { usePolling } from "@/lib/use-polling";
import { clearChatHistory } from "@/lib/chat-store";

type DeviceStatus = "pending" | "approved" | "rejected" | "revoked";
// direct — урилгаар орж ирсэн тул бүртгэл хүний нөөцийн зөвшөөрөлгүй шууд идэвхжинэ
type DeviceInfo = { signedIn: boolean; direct: boolean; device: { status: DeviceStatus; name: string } | null };
type Person = {
  rank: string;
  name: string;
  position: string;
  phone: string;
  photo: string;
  canRegister: boolean;
};
type Feed = {
  person: Person | null;
  pushEnabled: boolean;
  // endsAt — энэ цагт автоматаар устна (хугацаатай болохоос өмнөх мэдээлэлд null)
  alerts: { id: string; title: string; body: string; startsAt: string; endsAt: string | null; edited: boolean; acked: boolean }[];
  nextDuty: string | null;
  weeks: { start: string; days: { date: string; people: { name: string; me: boolean }[] }[] }[];
  // «Мэдээ»-ний тэмдэг: хянагчид хяналт хүлээж буй мэдээ, бусдад хамгийн сүүлийн мэдээний огноо
  news?: { pending: number; latestAt: string | null };
};

const button = "w-full h-11 rounded-md bg-primary text-primary-foreground font-semibold disabled:opacity-50";
const secondary = "w-full h-11 rounded-md border border-border text-foreground font-semibold flex items-center justify-center";

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

// «Нүүр» — зарлан мэдээлэл, харуулын хуваарь, бүртгэл; «Мэдээ» — сайтын мэдээ, хянах, бичих (?tab=news, ?news=<id>,
// ?write=new|<id>); «Чат» — алба хаагчид хоорондоо (?tab=chat, ?chat=<userId>); «Утас» — утасны жагсаалт (?tab=phones)
type Tab = "home" | "news" | "chat" | "phones";
const TITLES: Record<Tab, string> = { home: "Зарлан мэдээлэх", news: "Мэдээ", chat: "Чат", phones: "Утасны жагсаалт" };

export function AlertApp() {
  const [info, setInfo] = useState<DeviceInfo | null>(null);
  const params = useSearchParams();
  const chatWith = params.get("chat");
  const newsId = params.get("news");
  const write = params.get("write");
  const tab: Tab =
    chatWith || params.get("tab") === "chat"
      ? "chat"
      : newsId || write || params.get("tab") === "news"
        ? "news"
        : params.get("tab") === "phones"
          ? "phones"
          : "home";
  const approved = info?.device?.status === "approved";

  const load = useCallback(async () => {
    const res = await fetch("/api/app/device", { cache: "no-store" }).catch(() => null);
    // Сүлжээ тасарсан, сервер дахин ачаалж буй үед өмнөх төлөвөө хэвээр үлдээнэ
    if (!res?.ok) return;
    const data: DeviceInfo = await res.json();
    // Утсыг хүний нөөц хүчингүй болгосон (гээсэн г.м) эсвэл бүртгэлгүй бол утсан дээрх чатын түүхийг арилгана
    if (data.device?.status !== "approved") await clearChatHistory();
    setInfo(data);
  }, []);

  useEffect(() => {
    // Мэдэгдлийг хүлээн авах service worker — апп нээгдэх бүрд бүртгэнэ
    navigator.serviceWorker?.register("/sw.js").catch(() => {});
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  // Хүсэлт хүлээгдэж байх хооронд байнга шалгана — хүний нөөц зөвшөөрмөгц апп өөрөө нээгдэнэ
  usePolling(load, 10_000, info?.device?.status === "pending");

  return (
    <div className={`mx-auto max-w-md px-4 py-6 space-y-6 ${approved ? "pb-28" : ""}`}>
      <header className="flex items-center gap-3">
        <Image src="/logo.png" alt="" width={36} height={47} />
        <div>
          <p className="text-xs text-muted-foreground">Зэвсэгт хүчний 013 дугаар анги</p>
          <h1 className="text-xl font-bold text-foreground">{approved ? TITLES[tab] : TITLES.home}</h1>
        </div>
      </header>

      <InstallHint />

      {!info ? (
        <p className="text-sm text-muted-foreground">Ачааллаж байна...</p>
      ) : approved ? (
        <ApprovedView tab={tab} chatWith={chatWith} newsId={newsId} write={write} />
      ) : info.device?.status === "pending" ? (
        <Card>
          <p className="font-semibold text-foreground">Хүсэлт илгээгдсэн</p>
          <p className="text-sm text-muted-foreground">
            Хүний нөөц энэ утсыг зөвшөөрмөгц апп өөрөө нээгдэнэ.
          </p>
          <button onClick={load} className={secondary}>
            Дахин шалгах
          </button>
        </Card>
      ) : (
        <>
          {info.device && (
            <p className="text-sm text-red-400">
              {info.device.status === "revoked"
                ? "Энэ утасны бүртгэлийг хүний нөөц хүчингүй болгосон."
                : "Хүний нөөц энэ утасны хүсэлтийг татгалзсан."}
            </p>
          )}
          {info.signedIn ? <RequestForm direct={info.direct} onSent={load} /> : <SignInPrompt />}
        </>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-xl border border-border bg-card p-4 space-y-3">{children}</section>;
}

function SignInPrompt() {
  return (
    <Card>
      <p className="text-sm text-muted-foreground">
        Зарлан мэдээллийг авахын тулд и-мэйлээрээ нэвтэрч, энэ утсаа бүртгүүлнэ. Хүний нөөц зөвшөөрсний дараа
        ашиглана.
      </p>
      <Link href="/sign-in?redirect_url=/app" className={`${button} flex items-center justify-center`}>
        Нэвтрэх
      </Link>
      <Link href="/sign-up?redirect_url=/app" className={secondary}>
        Шинээр бүртгүүлэх
      </Link>
    </Card>
  );
}

/** Цол, нэр, утасны дугаар (заавал) — бүртгэл үүсгэх, засах маягтад. Албан тушаалыг асуухгүй (бүлгээр нь ялгана). */
function ProfileFields({ person }: { person?: Partial<Person> }) {
  return (
    <>
      <RankSelect defaultValue={person?.rank ?? ""} />
      <Input name="name" placeholder="Овог, нэр" required maxLength={120} defaultValue={person?.name} />
      <Input
        name="phone"
        type="tel"
        inputMode="numeric"
        placeholder="Утасны дугаар (8 оронтой)"
        required
        maxLength={16}
        defaultValue={person?.phone}
      />
    </>
  );
}

function RequestForm({ direct, onSent }: { direct: boolean; onSent: () => void }) {
  const install = useInstall();
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [inBrowser, setInBrowser] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setError("");
    const res = await fetch("/api/app/device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
    });
    setSending(false);
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? "Алдаа гарлаа");
      return;
    }
    onSent();
  }

  // iPhone-д суулгасан апп хөтчөөс тусдаа санах ойтой — хөтөч дээр үүсгэсэн бүртгэл апп руу шилжихгүй
  if (direct && install.ios && !install.standalone && !inBrowser) {
    return (
      <Card>
        <p className="font-semibold text-foreground">Таныг урьсан байна</p>
        <p className="text-sm text-muted-foreground">
          Дээрх зааврын дагуу аппаа нүүр дэлгэцэндээ суулгаад, суулгасан аппаас нэвтэрч бүртгэлээ үүсгэнэ үү.
        </p>
        <button onClick={() => setInBrowser(true)} className="text-xs text-primary hover:underline">
          Суулгахгүйгээр энд үргэлжлүүлэх
        </button>
      </Card>
    );
  }

  return (
    <Card>
      <p className="font-semibold text-foreground">{direct ? "Бүртгэл үүсгэх" : "Утсаа бүртгүүлэх"}</p>
      <p className="text-sm text-muted-foreground">
        {direct
          ? "Таныг урьсан тул бүртгэл тань шууд идэвхжинэ. "
          : "Хүний нөөц зөвшөөрсний дараа ашиглана. "}
        Нэг хүн нэг л утсаар ашиглана — утсаа солих, гээх үед хүний нөөцөөс дахин зөвшөөрөл авна.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <ProfileFields />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button type="submit" disabled={sending} className={button}>
          {sending ? "Илгээж байна..." : direct ? "Бүртгэл үүсгэх" : "Хүсэлт илгээх"}
        </button>
      </form>
    </Card>
  );
}

/** Утсан дээр авсан зургийг ≈400px болгож жижгэрүүлнэ — серверт жижиг файл очно */
async function shrinkImage(file: File, max = 400): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Зургийг уншиж чадсангүй"))), "image/jpeg", 0.85)
  );
}

/** Миний бүртгэл: зураг, цол, нэр, утас — засаж болно (хүний нөөц ч засна) */
function ProfileCard({ person, onChange }: { person: Person; onChange: () => void }) {
  const [editing, setEditing] = useState(!person.phone);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/app/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? "Алдаа гарлаа");
      return;
    }
    setEditing(false);
    onChange();
  }

  async function changePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/app/profile/photo", {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: await shrinkImage(file),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Алдаа гарлаа");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-4">
        <label className="relative cursor-pointer" title="Зураг солих">
          <Avatar person={person} />
          <span className="absolute -bottom-1 -right-1 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5">
            {busy ? "…" : "Зураг"}
          </span>
          <input type="file" accept="image/*" className="hidden" onChange={changePhoto} disabled={busy} />
        </label>
        <div className="min-w-0">
          <p className="font-bold text-foreground">{[person.rank, person.name].filter(Boolean).join(" ")}</p>
          {person.position && <p className="text-sm text-muted-foreground">{person.position}</p>}
          <p className="text-sm text-muted-foreground">{person.phone ? formatPhone(person.phone) : "Утасны дугаар алга"}</p>
        </div>
      </div>
      {editing ? (
        <form onSubmit={save} className="space-y-3">
          {!person.phone && <p className="text-sm text-yellow-400">Утасны дугаараа заавал оруулна уу.</p>}
          <ProfileFields person={person} />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={button}>
              Хадгалах
            </button>
            {person.phone && (
              <button type="button" onClick={() => setEditing(false)} className={secondary}>
                Болих
              </button>
            )}
          </div>
        </form>
      ) : (
        <>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button onClick={() => setEditing(true)} className={secondary}>
            Бүртгэлээ засах
          </button>
        </>
      )}
    </Card>
  );
}

type Invites = {
  pending: { id: string; email: string; createdAt: number }[];
  joined: (Pick<Person, "rank" | "name" | "position" | "phone" | "photo"> & { _id: string })[];
};

/** Хүний нөөцөөс «Бүртгэх эрх» авсан дарга доод хүмүүсээ и-мэйлээр урина */
function RegistrarSection() {
  const [data, setData] = useState<Invites | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/app/invitations", { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  async function invite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = String(new FormData(form).get("email") ?? "");
    setSending(true);
    setError("");
    setNotice("");
    const res = await fetch("/api/app/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSending(false);
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? "Алдаа гарлаа");
      return;
    }
    form.reset();
    setNotice(`${email} руу урилга илгээлээ. Тэр хүн и-мэйл дэх холбоосоор орж бүртгэлээ шууд үүсгэнэ.`);
    load();
  }

  async function cancel(id: string, email: string) {
    if (!confirm(`${email}-ийн урилгыг цуцлах уу?`)) return;
    await fetch(`/api/app/invitations/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <section className="space-y-3">
      <h2 className="font-bold text-foreground">Хүн бүртгэх</h2>
      <Card>
        <p className="text-sm text-muted-foreground">
          Доод хүмүүсээ и-мэйлээр нь урина. Урилгаар орж ирсэн хүн хүний нөөцийн зөвшөөрөл хүлээлгүй бүртгэлээ
          үүсгэнэ.
        </p>
        <form onSubmit={invite} className="flex gap-2">
          <Input name="email" type="email" required placeholder="name@example.com" />
          <button type="submit" disabled={sending} className="px-4 h-10 shrink-0 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            Урих
          </button>
        </form>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {notice && <p className="text-sm text-primary">{notice}</p>}
      </Card>
      {data && data.pending.length > 0 && (
        <ul className="rounded-xl border border-border divide-y divide-border text-sm">
          {data.pending.map((inv) => (
            <li key={inv.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-foreground">{inv.email}</span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-yellow-400">Хүлээгдэж байна</span>
                <button onClick={() => cancel(inv.id, inv.email)} className="text-xs text-red-400">
                  Цуцлах
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {data && data.joined.length > 0 && (
        <ul className="rounded-xl border border-border divide-y divide-border text-sm">
          {data.joined.map((p) => (
            <li key={p._id} className="px-4 py-2.5 flex items-center gap-3">
              <Avatar person={p} size={36} />
              <span className="min-w-0">
                <span className="block text-foreground">{[p.rank, p.name].filter(Boolean).join(" ")}</span>
                <span className="block text-xs text-muted-foreground">
                  {[p.position, formatPhone(p.phone)].filter(Boolean).join(" · ")}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type AppBadge = Navigator & { setAppBadge?: (count?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

const NEWS_SEEN_KEY = "zkh013-news-seen";

function ApprovedView({
  tab,
  chatWith,
  newsId,
  write,
}: {
  tab: Tab;
  chatWith: string | null;
  newsId: string | null;
  write: string | null;
}) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [unread, setUnread] = useState(0);
  // Мэдээ бичсэн, хянасны дараа жагсаалтыг шинэчилнэ
  const [newsVersion, setNewsVersion] = useState(0);
  const [newsNotice, setNewsNotice] = useState("");
  // «Мэдээ»-г сүүлд нээхэд байсан хамгийн шинэ мэдээний огноо (null — хараахан уншаагүй)
  const [newsSeen, setNewsSeen] = useState<string | null>(null);
  // Чатыг апп дотроос нээсэн бол «Буцах» нь өмнөх хуудас руу (history.back) — мэдэгдлээр шууд нээсэн бол жагсаалт руу
  const pushed = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/app/feed", { cache: "no-store" });
    if (res.ok) setFeed(await res.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);
  // Апп руу буцаж ороход (мэдэгдэл дарсны дараа г.м) болон минут тутам шинэчилнэ — товлосон мэдээлэл эхлэх цагтаа
  // гарч ирж, хугацаа нь дууссан нь алга болно
  usePolling(load, 60_000);

  // Нүүр хуудсанд байхад уншаагүй зурвасын тоо (мөн «Идэвхтэй» төлөвийг сэргээнэ); чатын жагсаалт өөрөө шинэчилнэ
  const loadUnread = useCallback(async () => {
    const res = await fetch("/api/app/chat?summary=1", { cache: "no-store" }).catch(() => null);
    if (res?.ok) setUnread((await res.json()).unreadTotal);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refresh the unread count when returning home
    if (tab === "home") loadUnread();
  }, [tab, loadUnread]);
  usePolling(loadUnread, POLL_MS.home, tab === "home");

  // Аппын дүрс дээр уншаагүй зурвасын тоо
  useEffect(() => {
    const nav = navigator as AppBadge;
    if (unread > 0) nav.setAppBadge?.(unread).catch(() => {});
    else nav.clearAppBadge?.().catch(() => {});
  }, [unread]);

  useEffect(() => {
    // Апп хаагдах/далд ороход «Идэвхтэй» төлөвийг шууд унтраана
    const away = () => navigator.sendBeacon?.("/api/app/presence");
    const onHidden = () => document.visibilityState === "hidden" && away();
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", away);
    // Мэдэгдэл дарахад (апп нээлттэй үед) service worker тухайн хэсгийг нээлгэнэ
    const onMessage = (e: MessageEvent) => {
      const url = e.data?.type === "open" && typeof e.data.url === "string" ? e.data.url : "";
      if (!url.startsWith("/app")) return;
      if (url.includes("chat=") || url.includes("news=")) {
        pushed.current = true;
        window.history.pushState(null, "", url);
      } else window.history.replaceState(null, "", url);
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", away);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, []);

  const openChat = useCallback((userId: string) => {
    pushed.current = true;
    window.history.pushState(null, "", `/app?chat=${encodeURIComponent(userId)}`);
  }, []);
  const closeChat = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else window.history.replaceState(null, "", "/app?tab=chat");
  }, []);
  const switchTab = (next: Tab) => {
    if (next !== tab) window.history.replaceState(null, "", next === "home" ? "/app" : `/app?tab=${next}`);
  };

  // Мэдээ: дэлгэрэнгүй, бичих цонх — чат шиг «Буцах» нь өмнөх хуудас руу
  const openNews = useCallback((id: string) => {
    pushed.current = true;
    window.history.pushState(null, "", `/app?news=${encodeURIComponent(id)}`);
  }, []);
  const openWrite = useCallback((id: string | null) => {
    pushed.current = true;
    window.history.pushState(null, "", `/app?write=${id ? encodeURIComponent(id) : "new"}`);
  }, []);
  const closeNews = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else window.history.replaceState(null, "", "/app?tab=news");
  }, []);
  const newsChanged = useCallback(
    (message: string) => {
      setNewsNotice(message);
      setNewsVersion((v) => v + 1);
      load();
      // Хянасан, бичсэний дараа жагсаалт руу буцна
      pushed.current = false;
      window.history.replaceState(null, "", "/app?tab=news");
    },
    [load]
  );

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read the per-phone "seen" marker once
      setNewsSeen(localStorage.getItem(NEWS_SEEN_KEY) ?? "");
    } catch {
      setNewsSeen("");
    }
  }, []);
  const latestNews = feed?.news?.latestAt ?? null;
  useEffect(() => {
    if (tab !== "news" || !latestNews || newsSeen === null || latestNews === newsSeen) return;
    try {
      localStorage.setItem(NEWS_SEEN_KEY, latestNews);
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the news tab is open, so the newest item is seen
    setNewsSeen(latestNews);
  }, [tab, latestNews, newsSeen]);
  const newsBadge = {
    count: feed?.news?.pending ?? 0,
    dot: newsSeen !== null && latestNews !== null && latestNews > newsSeen,
  };

  async function ack(id: string) {
    await fetch(`/api/app/alerts/${id}/ack`, { method: "POST" });
    load();
  }

  return (
    <>
      <div className={tab === "home" ? "space-y-6" : "hidden"}>
        {feed ? <HomeView feed={feed} onChange={load} onAck={ack} /> : <p className="text-sm text-muted-foreground">Ачааллаж байна...</p>}
      </div>
      {tab === "news" && (
        <NewsList version={newsVersion} notice={newsNotice} onOpen={openNews} onWrite={() => openWrite(null)} />
      )}
      {newsId && <NewsDetail key={newsId} id={newsId} onBack={closeNews} onEdit={openWrite} onChanged={newsChanged} />}
      {write && <NewsWrite key={write} id={write === "new" ? null : write} onBack={closeNews} onDone={newsChanged} />}
      {tab === "chat" && !chatWith && <ChatList onOpen={openChat} onUnread={setUnread} pushEnabled={feed?.pushEnabled ?? true} />}
      {tab === "phones" && <Directory />}
      {chatWith && <Conversation key={chatWith} userId={chatWith} onBack={closeChat} />}
      {!chatWith && !newsId && !write && <BottomNav tab={tab} unread={unread} news={newsBadge} onTab={switchTab} />}
    </>
  );
}

const badgeClass =
  "absolute -right-3 -top-1.5 h-4 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-4 text-white";

/** Доод цэс: Нүүр / Мэдээ (хянах мэдээний тоо, шинэ мэдээ) / Чат (уншаагүй зурвасын тоо) / Утас (утасны жагсаалт) */
function BottomNav({
  tab,
  unread,
  news,
  onTab,
}: {
  tab: Tab;
  unread: number;
  news: { count: number; dot: boolean };
  onTab: (tab: Tab) => void;
}) {
  const item = (t: Tab) =>
    `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${tab === t ? "text-primary" : "text-muted-foreground"}`;
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Аппын цэс"
    >
      <div className="mx-auto flex max-w-md">
        <button onClick={() => onTab("home")} className={item("home")} aria-current={tab === "home" ? "page" : undefined}>
          <House className="size-5" aria-hidden />
          Нүүр
        </button>
        <button onClick={() => onTab("news")} className={item("news")} aria-current={tab === "news" ? "page" : undefined}>
          <span className="relative">
            <Newspaper className="size-5" aria-hidden />
            {news.count > 0 ? (
              <span className={badgeClass} aria-label={`${news.count} хянах мэдээ`}>
                {news.count > 99 ? "99+" : news.count}
              </span>
            ) : (
              news.dot && <span className="absolute -right-1 -top-0.5 size-2 rounded-full bg-red-500" aria-label="Шинэ мэдээ" />
            )}
          </span>
          Мэдээ
        </button>
        <button onClick={() => onTab("chat")} className={item("chat")} aria-current={tab === "chat" ? "page" : undefined}>
          <span className="relative">
            <MessageCircle className="size-5" aria-hidden />
            {unread > 0 && (
              <span className={badgeClass} aria-label={`${unread} уншаагүй зурвас`}>
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </span>
          Чат
        </button>
        <button onClick={() => onTab("phones")} className={item("phones")} aria-current={tab === "phones" ? "page" : undefined}>
          <Phone className="size-5" aria-hidden />
          Утас
        </button>
      </div>
    </nav>
  );
}

/** «Нүүр»: миний бүртгэл, дараагийн манаа, мэдэгдэл, зарлан мэдээлэл, харуулын хуваарь, хүн бүртгэх */
function HomeView({ feed, onChange, onAck }: { feed: Feed; onChange: () => void; onAck: (id: string) => void }) {
  return (
    <>
      {feed.person && <ProfileCard person={feed.person} onChange={onChange} />}

      {feed.nextDuty && <NextDuty date={feed.nextDuty} />}

      <PushToggle enabled={feed.pushEnabled} onChange={onChange} />

      <section className="space-y-3">
        <h2 className="font-bold text-foreground">Зарлан мэдээлэл</h2>
        {feed.alerts.length === 0 && <p className="text-sm text-muted-foreground">Одоогоор мэдээлэл алга.</p>}
        {feed.alerts.map((a) => (
          <Card key={a.id}>
            <div>
              <p className="font-bold text-foreground">{a.title}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(a.startsAt)}
                {a.endsAt && ` · ${formatDateTime(a.endsAt)} хүртэл`}
                {a.edited && " · засварласан"}
              </p>
            </div>
            {a.body && <p className="text-sm text-foreground whitespace-pre-line">{a.body}</p>}
            {a.acked ? (
              <p className="text-sm font-semibold text-primary">✓ Хүлээн авсан</p>
            ) : (
              <button onClick={() => onAck(a.id)} className={button}>
                Хүлээн авлаа
              </button>
            )}
          </Card>
        ))}
      </section>

      {feed.weeks.map((week, i) => (
        <DutyWeek key={week.start} title={i === 0 ? "Энэ 7 хоног" : "Дараагийн 7 хоног"} week={week} />
      ))}

      {feed.person?.canRegister && <RegistrarSection />}
    </>
  );
}

/** «Та 3 хоногийн дараа харуул хоногийн манаанд гарна» */
function NextDuty({ date }: { date: string }) {
  const today = todayUb();
  return (
    <section className="rounded-xl border border-primary/50 bg-primary/10 p-4 space-y-1">
      <p className="text-xs text-muted-foreground">{DUTY_LABEL}</p>
      {date === today ? (
        <p className="font-bold text-foreground">{DUTY_REMINDER_TEXT}</p>
      ) : (
        <p className="font-bold text-foreground">Та {relativeDay(date, today)} харуул хоногийн манаанд гарна.</p>
      )}
      <p className="text-sm text-primary">{formatDay(date)}</p>
    </section>
  );
}

/** 7 хоногийн харуул хоногийн манааны хуваарь — өөрийн өдөр, өнөөдрийг тодруулна */
function DutyWeek({ title, week }: { title: string; week: Feed["weeks"][number] }) {
  const today = todayUb();
  const empty = week.days.every((d) => d.people.length === 0);
  return (
    <section className="space-y-3">
      <h2 className="font-bold text-foreground">
        {DUTY_LABEL} — {title}
        <span className="block text-xs font-normal text-muted-foreground">{formatWeek(week.start)}</span>
      </h2>
      {empty ? (
        <p className="text-sm text-muted-foreground">Хуваарь гараагүй байна.</p>
      ) : (
        <ul className="rounded-xl border border-border divide-y divide-border">
          {week.days.map((d) => {
            const mine = d.people.some((p) => p.me);
            return (
              <li
                key={d.date}
                className={`px-4 py-2.5 flex justify-between gap-3 text-sm ${mine ? "bg-primary/10" : ""} ${d.date < today ? "opacity-50" : ""}`}
              >
                <span className={d.date === today ? "text-primary font-semibold" : "text-foreground"}>
                  {formatDay(d.date)}
                </span>
                <span className="text-right text-muted-foreground">
                  {d.people.length === 0
                    ? "—"
                    : d.people.map((p, i) => (
                        <span key={i} className={p.me ? "text-primary font-semibold" : ""}>
                          {i > 0 && ", "}
                          {p.name}
                        </span>
                      ))}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function PushToggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  const [state, setState] = useState<"idle" | "working" | "unsupported" | "denied">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability check after mount
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) setState("unsupported");
    else if (Notification.permission === "denied") setState("denied");
  }, []);

  async function enable() {
    setState("working");
    setError("");
    try {
      const { publicKey } = await (await fetch("/api/app/push")).json();
      if (!publicKey) throw new Error("Сервер дээр мэдэгдэл тохируулаагүй байна");
      if ((await Notification.requestPermission()) !== "granted") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
      const res = await fetch("/api/app/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Алдаа гарлаа");
      setState("idle");
      onChange();
    } catch (err) {
      setState("idle");
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
    }
  }

  if (state === "unsupported") {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">
          Энэ хөтөч мэдэгдэл хүлээж авахгүй. iPhone дээр доорх зааврын дагуу аппыг нүүр дэлгэцэндээ суулгаад, суулгасан
          аппаас нээнэ үү.
        </p>
      </Card>
    );
  }
  if (enabled && state !== "denied") {
    return <p className="text-sm font-semibold text-primary">✓ Мэдэгдэл асаалттай</p>;
  }
  return (
    <Card>
      <p className="text-sm text-muted-foreground">
        {state === "denied"
          ? "Мэдэгдлийг хориглосон байна. Утасныхаа тохиргооноос энэ аппын мэдэгдлийг (Notifications) зөвшөөрнө үү."
          : "Зарлан мэдээлэл, чатын зурвас ирэхэд утас тань дуугарч мэдэгдэнэ."}
      </p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {state !== "denied" && (
        <button onClick={enable} disabled={state === "working"} className={button}>
          {state === "working" ? "Асааж байна..." : "Мэдэгдэл асаах"}
        </button>
      )}
    </Card>
  );
}

/** Суулгаагүй бол дээд хэсэгт: суулгах товч эсвэл заавар (дэлгэрэнгүйг /download-д) */
function InstallHint() {
  const state = useInstall();
  if (!state.ready || state.standalone || state.installed) return null;
  return (
    <Card>
      <p className="font-semibold text-foreground">Эхлээд утсандаа суулгана</p>
      <p className="text-sm text-muted-foreground">Суулгасан аппаас нэвтэрч, утсаа бүртгүүлнэ.</p>
      {state.install && !state.inApp ? (
        <button onClick={state.install} className={button}>
          Апп татах
        </button>
      ) : (
        <InstallSteps state={state} />
      )}
      <Link href="/download" className="block text-xs text-primary hover:underline">
        Дэлгэрэнгүй заавар
      </Link>
    </Card>
  );
}
