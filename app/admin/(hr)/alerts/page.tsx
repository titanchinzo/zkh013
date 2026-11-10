"use client";

import { useCallback, useEffect, useState } from "react";
import { Input, Textarea } from "@/components/ui/input";
import { ALERT_LIMITS } from "@/lib/hr";

type AlertRow = {
  id: string;
  title: string;
  body: string;
  createdByName: string;
  createdAt: string;
  acks: { name: string; at: string }[];
  waiting: string[];
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [recipients, setRecipients] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const data = await (await fetch("/api/hr/alerts")).json();
    setAlerts(data.alerts ?? []);
    setRecipients(data.recipients ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    if (!confirm(`«${data.title}» мэдээллийг ${recipients} утас руу илгээх үү?`)) return;
    setSending(true);
    setError("");
    setNotice("");
    const res = await fetch("/api/hr/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json().catch(() => null);
    setSending(false);
    if (!res.ok) {
      setError(result?.error ?? "Алдаа гарлаа");
      return;
    }
    form.reset();
    setNotice(
      `Илгээлээ: ${result.sent} утсанд мэдэгдэл очлоо` +
        (result.failed ? `, ${result.failed} утсанд хүрсэнгүй` : "") +
        ". Мэдэгдэл асаагаагүй хүмүүс аппаа нээхэд харна."
    );
    load();
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Зарлан мэдээлэх</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Энд бичсэн мэдээлэл зөвшөөрөгдсөн бүх утсанд ({recipients}) мэдэгдлээр очиж, аппад нь харагдана. Хүн бүр
          «Хүлээн авлаа» дарахад энд тэмдэглэгдэнэ.
        </p>
      </div>

      <form onSubmit={send} className="rounded-xl border border-border bg-card p-4 space-y-3">
        <Input name="title" placeholder="Гарчиг (жишээ нь: Зарлан цуглуулах)" required maxLength={ALERT_LIMITS.title} />
        <Textarea name="body" placeholder="Дэлгэрэнгүй (заавал биш)" maxLength={ALERT_LIMITS.body} className="min-h-28" />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={sending}
          className="px-6 h-10 rounded-md bg-primary text-primary-foreground font-semibold disabled:opacity-50"
        >
          {sending ? "Илгээж байна..." : "Илгээх"}
        </button>
      </form>
      {notice && <p className="text-sm text-primary">{notice}</p>}

      <section className="space-y-3">
        <h2 className="font-bold text-foreground">Илгээсэн мэдээлэл</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Ачааллаж байна...</p>
        ) : alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Одоогоор илгээгээгүй байна.</p>
        ) : (
          alerts.map((a) => (
            <div key={a.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-bold text-foreground">{a.title}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(a.createdAt).toLocaleString("mn-MN")}
                  {a.createdByName && ` · ${a.createdByName}`}
                </p>
              </div>
              {a.body && <p className="text-sm text-foreground whitespace-pre-line">{a.body}</p>}
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
                        ✓ {k.name} — {new Date(k.at).toLocaleTimeString("mn-MN")}
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
            </div>
          ))
        )}
      </section>
    </div>
  );
}
