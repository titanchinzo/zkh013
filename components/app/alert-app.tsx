"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { RankSelect } from "@/components/hr/rank-select";
import { DUTY_LABEL, DUTY_REMINDER_TEXT, formatDay, formatWeek, relativeDay, todayUb } from "@/lib/hr";
import { InstallSteps, useInstall } from "@/components/app/install";

type DeviceStatus = "pending" | "approved" | "rejected" | "revoked";
type DeviceInfo = { signedIn: boolean; device: { status: DeviceStatus; name: string } | null };
type Feed = {
  person: { rank: string; name: string; position: string } | null;
  pushEnabled: boolean;
  alerts: { id: string; title: string; body: string; createdAt: string; acked: boolean }[];
  nextDuty: string | null;
  weeks: { start: string; days: { date: string; people: { name: string; me: boolean }[] }[] }[];
};

const button = "w-full h-11 rounded-md bg-primary text-primary-foreground font-semibold disabled:opacity-50";
const secondary = "w-full h-11 rounded-md border border-border text-foreground font-semibold flex items-center justify-center";

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export function AlertApp() {
  const [info, setInfo] = useState<DeviceInfo | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/app/device", { cache: "no-store" });
    setInfo(await res.json());
  }, []);

  useEffect(() => {
    // Мэдэгдлийг хүлээн авах service worker — апп нээгдэх бүрд бүртгэнэ
    navigator.serviceWorker?.register("/sw.js").catch(() => {});
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-md px-4 py-6 space-y-6">
      <header className="flex items-center gap-3">
        <Image src="/logo.png" alt="" width={36} height={47} />
        <div>
          <p className="text-xs text-muted-foreground">Зэвсэгт хүчний 013 дугаар анги</p>
          <h1 className="text-xl font-bold text-foreground">Зарлан мэдээлэх</h1>
        </div>
      </header>

      <InstallHint />

      {!info ? (
        <p className="text-sm text-muted-foreground">Ачааллаж байна...</p>
      ) : info.device?.status === "approved" ? (
        <ApprovedView />
      ) : info.device?.status === "pending" ? (
        <Card>
          <p className="font-semibold text-foreground">Хүсэлт илгээгдсэн</p>
          <p className="text-sm text-muted-foreground">
            Хүний нөөц энэ утсыг зөвшөөрсний дараа зарлан мэдээлэл энд харагдана.
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
          {info.signedIn ? <RequestForm onSent={load} /> : <SignInPrompt />}
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

function RequestForm({ onSent }: { onSent: () => void }) {
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

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

  return (
    <Card>
      <p className="font-semibold text-foreground">Утсаа бүртгүүлэх</p>
      <p className="text-sm text-muted-foreground">
        Нэг хүн нэг л утсаар ашиглана. Утсаа солих, гээх үед хүний нөөцөөс дахин зөвшөөрөл авна.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <RankSelect />
        <Input name="name" placeholder="Овог, нэр" required maxLength={120} />
        <Input name="position" placeholder="Албан тушаал" maxLength={120} />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button type="submit" disabled={sending} className={button}>
          {sending ? "Илгээж байна..." : "Хүсэлт илгээх"}
        </button>
      </form>
    </Card>
  );
}

function ApprovedView() {
  const [feed, setFeed] = useState<Feed | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/app/feed", { cache: "no-store" });
    if (res.ok) setFeed(await res.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
    // Апп руу буцаж ороход (мэдэгдэл дарсны дараа г.м) шинэчилнэ
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  async function ack(id: string) {
    await fetch(`/api/app/alerts/${id}/ack`, { method: "POST" });
    load();
  }

  if (!feed) return <p className="text-sm text-muted-foreground">Ачааллаж байна...</p>;

  return (
    <>
      {feed.person && (
        <p className="text-sm text-muted-foreground">
          {[feed.person.rank, feed.person.name].filter(Boolean).join(" ")}
          {feed.person.position && ` · ${feed.person.position}`}
        </p>
      )}

      {feed.nextDuty && <NextDuty date={feed.nextDuty} />}

      <PushToggle enabled={feed.pushEnabled} onChange={load} />

      <section className="space-y-3">
        <h2 className="font-bold text-foreground">Зарлан мэдээлэл</h2>
        {feed.alerts.length === 0 && <p className="text-sm text-muted-foreground">Одоогоор мэдээлэл алга.</p>}
        {feed.alerts.map((a) => (
          <Card key={a.id}>
            <div>
              <p className="font-bold text-foreground">{a.title}</p>
              <p className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString("mn-MN")}</p>
            </div>
            {a.body && <p className="text-sm text-foreground whitespace-pre-line">{a.body}</p>}
            {a.acked ? (
              <p className="text-sm font-semibold text-primary">✓ Хүлээн авсан</p>
            ) : (
              <button onClick={() => ack(a.id)} className={button}>
                Хүлээн авлаа
              </button>
            )}
          </Card>
        ))}
      </section>

      {feed.weeks.map((week, i) => (
        <DutyWeek key={week.start} title={i === 0 ? "Энэ 7 хоног" : "Дараагийн 7 хоног"} week={week} />
      ))}
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
          : "Зарлан мэдээлэл ирэхэд утас тань дуугарч мэдэгдэх болно."}
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
