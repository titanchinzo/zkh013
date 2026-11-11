"use client";

import { useCallback, useEffect, useState } from "react";
import { Input, Textarea } from "@/components/ui/input";
import { ALERT_DURATIONS, ALERT_LIMITS, formatDateTime, fromUbInput, toUbInput } from "@/lib/hr";
import { usePolling } from "@/lib/use-polling";

type AlertRow = {
  id: string;
  title: string;
  body: string;
  createdByName: string;
  createdAt: string;
  startsAt: string;
  // Хугацаатай болохоос өмнө илгээсэн мэдээлэлд null
  endsAt: string | null;
  // false — товлосон, эхлэх цагтаа утсанд очно
  notified: boolean;
  editedAt: string | null;
  acks: { name: string; at: string }[];
  waiting: string[];
};

const smallButton = "px-3 py-1.5 text-xs font-semibold rounded-md border border-border text-foreground";
const dangerButton = "px-3 py-1.5 text-xs font-semibold rounded-md border border-red-400/40 text-red-400";
const primaryButton = "px-6 h-10 rounded-md bg-primary text-primary-foreground font-semibold disabled:opacity-50";
const JSON_HEADERS = { "Content-Type": "application/json" };

/** Маягтын утгууд — огноог Улаанбаатарын цагаар уншина */
function readForm(form: HTMLFormElement) {
  const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
  return {
    title: (f.title ?? "").trim(),
    body: f.body ?? "",
    startsAt: f.startsAt ? fromUbInput(f.startsAt) : null,
    endsAt: f.endsAt ? fromUbInput(f.endsAt) : null,
    renotify: f.renotify === "on",
  };
}

type FormValues = ReturnType<typeof readForm>;

const toBody = (v: FormValues) =>
  JSON.stringify({
    title: v.title,
    body: v.body,
    startsAt: v.startsAt?.toISOString(),
    endsAt: v.endsAt?.toISOString(),
    renotify: v.renotify,
  });

/** Хугацааны товч: эхлэх цагаас (хоосон бол одооноос) ms-ийн дараах цаг, datetime-local-ийн утгаар */
function endAfter(start: string, ms: number) {
  return toUbInput(new Date((fromUbInput(start)?.getTime() ?? Date.now()) + ms));
}

async function errorOf(res: Response) {
  return (await res.json().catch(() => null))?.error ?? "Алдаа гарлаа";
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [recipients, setRecipients] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // Илгээсний дараа маягтыг цэвэрлэнэ (эхлэх, дуусах цагийн утгуудын хамт)
  const [formKey, setFormKey] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch("/api/hr/alerts", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    setAlerts(data.alerts ?? []);
    setRecipients(data.recipients ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  // «Хүлээн авлаа» дарсан хүмүүс, товлосон мэдээлэл илгээгдэх, хугацаа нь дуусч устах нь өөрөө шинэчлэгдэнэ
  usePolling(load, 15_000);

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = readForm(e.currentTarget);
    if (!v.endsAt) {
      setError("Дуусах хугацааг сонгоно уу");
      return;
    }
    const later = v.startsAt && v.startsAt.getTime() > Date.now() ? v.startsAt : null;
    const question =
      `«${v.title}» мэдээллийг ${later ? `${formatDateTime(later)}-д` : "одоо"} ${recipients} утас руу илгээх үү? ` +
      `${formatDateTime(v.endsAt)} хүртэл харагдаад автоматаар устна.`;
    if (!confirm(question)) return;
    setSending(true);
    setError("");
    setNotice("");
    const res = await fetch("/api/hr/alerts", { method: "POST", headers: JSON_HEADERS, body: toBody(v) });
    setSending(false);
    if (!res.ok) {
      setError(await errorOf(res));
      return;
    }
    const result = await res.json();
    setFormKey((k) => k + 1);
    setNotice(
      result.scheduled
        ? `Товлолоо: ${formatDateTime(v.startsAt!)}-д утсанд мэдэгдэл очно.`
        : `Илгээлээ: ${result.sent} утсанд мэдэгдэл очлоо` +
            (result.failed ? `, ${result.failed} утсанд хүрсэнгүй` : "") +
            ". Мэдэгдэл асаагаагүй хүмүүс аппаа нээхэд харна."
    );
    load();
  }

  function changed(message: string) {
    setError("");
    setNotice(message);
    load();
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Зарлан мэдээлэх</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Энд бичсэн мэдээлэл зөвшөөрөгдсөн бүх утсанд ({recipients}) мэдэгдлээр очиж, аппад нь харагдана. Хүн бүр
          «Хүлээн авлаа» дарахад энд тэмдэглэгдэнэ. Мэдээлэл бүр хугацаатай: эхлэх цагт нь утсанд очиж, дуусах цаг
          өнгөрмөгц утаснаас болон эндээс автоматаар устна.
        </p>
      </div>

      <form key={formKey} onSubmit={send} className="rounded-xl border border-border bg-card p-4 space-y-3">
        <AlertFields />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button type="submit" disabled={sending} className={primaryButton}>
          {sending ? "Илгээж байна..." : "Илгээх"}
        </button>
      </form>
      {notice && <p className="text-sm text-primary">{notice}</p>}

      <section className="space-y-3">
        <h2 className="font-bold text-foreground">Идэвхтэй болон товлосон мэдээлэл</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Ачааллаж байна...</p>
        ) : alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Одоогоор мэдээлэл алга.</p>
        ) : (
          alerts.map((a) => <AlertCard key={a.id} alert={a} recipients={recipients} onChanged={changed} />)
        )}
      </section>
    </div>
  );
}

/** Гарчиг, дэлгэрэнгүй, эхлэх, дуусах цаг — шинээр илгээх, засах маягтад */
function AlertFields({ alert }: { alert?: AlertRow }) {
  const [start, setStart] = useState(alert ? toUbInput(alert.startsAt) : "");
  const [end, setEnd] = useState(alert?.endsAt ? toUbInput(alert.endsAt) : "");

  return (
    <>
      <Input
        name="title"
        placeholder="Гарчиг (жишээ нь: Зарлан цуглуулах)"
        required
        maxLength={ALERT_LIMITS.title}
        defaultValue={alert?.title}
      />
      <Textarea
        name="body"
        placeholder="Дэлгэрэнгүй (заавал биш)"
        maxLength={ALERT_LIMITS.body}
        className="min-h-28"
        defaultValue={alert?.body}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Эхлэх{alert ? "" : " — хоосон бол одоо илгээнэ"}</span>
          <Input
            type="datetime-local"
            name="startsAt"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="[color-scheme:dark]"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Дуусах — энэ цагт автоматаар устна</span>
          <Input
            type="datetime-local"
            name="endsAt"
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="[color-scheme:dark]"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Хугацаа:</span>
        {ALERT_DURATIONS.map((d) => (
          <button key={d.label} type="button" onClick={() => setEnd(endAfter(start, d.ms))} className={smallButton}>
            {d.label}
          </button>
        ))}
      </div>
    </>
  );
}

function AlertCard({
  alert: a,
  recipients,
  onChanged,
}: {
  alert: AlertRow;
  recipients: number;
  onChanged: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = readForm(e.currentTarget);
    if (!v.endsAt) {
      setError("Дуусах хугацааг сонгоно уу");
      return;
    }
    if (v.renotify && !confirm(`«${v.title}» мэдээллийг ${recipients} утас руу дахин мэдэгдэх үү?`)) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/hr/alerts/${a.id}`, { method: "PATCH", headers: JSON_HEADERS, body: toBody(v) });
    setSaving(false);
    if (!res.ok) {
      setError(await errorOf(res));
      return;
    }
    const result = await res.json();
    setEditing(false);
    onChanged(
      typeof result.sent === "number" ? `Хадгаллаа. ${result.sent} утсанд мэдэгдэл очлоо.` : `«${v.title}» мэдээллийг хадгаллаа.`
    );
  }

  async function remove() {
    if (!confirm(`«${a.title}» мэдээллийг устгах уу? Утсан дээрээс ч арилж, хэн хүлээн авсан тэмдэглэл нь хамт устна.`)) {
      return;
    }
    const res = await fetch(`/api/hr/alerts/${a.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError(await errorOf(res));
      return;
    }
    onChanged(`«${a.title}» мэдээллийг устгалаа.`);
  }

  if (editing) {
    return (
      <form onSubmit={save} className="rounded-xl border border-primary/40 bg-card p-4 space-y-3">
        <AlertFields alert={a} />
        {a.notified && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" name="renotify" className="size-4 accent-primary" />
            Утсанд дахин мэдэгдэх — «Хүлээн авлаа» тэмдэглэл шинээр эхэлнэ
          </label>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className={primaryButton}>
            {saving ? "Хадгалж байна..." : "Хадгалах"}
          </button>
          <button type="button" onClick={() => setEditing(false)} className={smallButton}>
            Болих
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="font-bold text-foreground">{a.title}</p>
          <p className="text-xs">
            {a.notified ? (
              <span className="text-primary font-semibold">Идэвхтэй</span>
            ) : (
              <span className="text-yellow-400 font-semibold">Товлосон · {formatDateTime(a.startsAt)}-д утсанд очно</span>
            )}
            <span className="text-muted-foreground">
              {a.endsAt ? ` · ${formatDateTime(a.endsAt)} хүртэл, дараа нь автоматаар устна` : " · Дуусах хугацаагүй"}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(a.createdAt)}
            {a.createdByName && ` · ${a.createdByName}`}
            {a.editedAt && ` · засварласан ${formatDateTime(a.editedAt)}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(true)} className={smallButton}>
            Засах
          </button>
          <button onClick={remove} className={dangerButton}>
            Устгах
          </button>
        </div>
      </div>
      {a.body && <p className="text-sm text-foreground whitespace-pre-line">{a.body}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {a.notified && (
        <>
          <p className="text-sm">
            <span className="text-primary font-semibold">Хүлээн авсан: {a.acks.length}</span>
            <span className="text-muted-foreground"> · Хүлээгдэж буй: {a.waiting.length}</span>
          </p>
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer">Хэн хүлээн авсан</summary>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <ul className="space-y-1">
                {a.acks.map((k) => (
                  <li key={k.name + k.at}>
                    ✓ {k.name} — {formatDateTime(k.at)}
                  </li>
                ))}
              </ul>
              <ul className="space-y-1">
                {a.waiting.map((name) => (
                  <li key={name} className="text-yellow-400">
                    … {name}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
