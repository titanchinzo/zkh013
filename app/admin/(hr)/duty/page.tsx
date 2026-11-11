"use client";

import { useCallback, useEffect, useState } from "react";
import { DUTY_LABEL, addDays, formatDay, formatWeek, personnelLabel, todayUb, weekStart } from "@/lib/hr";

type Person = { _id: string; rank: string; name: string; position: string; active: boolean };
type WeekData = {
  weekStart: string;
  week: { date: string; duty: string[]; reminded: string[] }[];
  personnel: Person[];
};

const selectClass = "h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground";
const navButton = "h-9 px-3 rounded-md border border-border text-sm text-foreground";

export default function DutyPage() {
  const [start, setStart] = useState(() => weekStart(todayUb()));
  const [data, setData] = useState<WeekData | null>(null);
  const [duty, setDuty] = useState<Record<string, string[]>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async (from: string) => {
    const res = await fetch(`/api/hr/days/${from}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const d: WeekData = await res.json();
    setData(d);
    setDuty(Object.fromEntries(d.week.map((w) => [w.date, w.duty])));
    setDirty(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch the shown week
    load(start);
  }, [start, load]);

  function go(from: string) {
    if (dirty && !confirm("Хадгалаагүй өөрчлөлт байна. Орхих уу?")) return;
    setMessage("");
    setStart(from);
  }

  function change(date: string, ids: string[]) {
    setDuty({ ...duty, [date]: ids });
    setDirty(true);
    setMessage("");
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/hr/days/${start}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duty }),
    });
    setSaving(false);
    if (!res.ok) {
      setMessage((await res.json().catch(() => null))?.error ?? "Алдаа гарлаа");
      return;
    }
    await load(start);
    setMessage("Хадгаллаа. Шинээр томилогдсон хүмүүсийн утсанд мэдэгдэл очно.");
  }

  const today = todayUb();
  const thisWeek = weekStart(today);
  const ready = data?.weekStart === start ? data : null;
  const byId = new Map((ready?.personnel ?? []).map((p) => [p._id, p]));
  const which = start === thisWeek ? "энэ 7 хоног" : start === addDays(thisWeek, 7) ? "дараагийн 7 хоног" : "";

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{DUTY_LABEL}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Харуул хоногийн манааг 7 хоногоор (Даваа–Ням) гаргаж, өдөр бүрд хүмүүсийг нь сонгоно. Томилогдсон хүнд
          мэдэгдэл очиж, манаанд гарах өдрөө 11 цагаас хойш «Тайван хоноорой» мэдэгдэл авна (✓ — очсон). Алба хаагчид
          энэ болон дараагийн 7 хоногийн хуваарийг утсандаа харна.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => go(addDays(start, -7))} className={navButton}>
          ◀ Өмнөх 7 хоног
        </button>
        <button onClick={() => go(thisWeek)} className={navButton}>
          Энэ 7 хоног
        </button>
        <button onClick={() => go(addDays(start, 7))} className={navButton}>
          Дараагийн 7 хоног ▶
        </button>
      </div>

      <section className="space-y-3">
        <h2 className="font-bold text-foreground">
          {formatWeek(start)} {which && <span className="text-sm font-normal text-muted-foreground">({which})</span>}
        </h2>
        {!ready ? (
          <p className="text-sm text-muted-foreground">Ачааллаж байна...</p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {ready.week.map((w) => {
                  const selected = duty[w.date] ?? [];
                  const available = ready.personnel.filter((p) => p.active && !selected.includes(p._id));
                  return (
                    <tr
                      key={w.date}
                      className={`border-t border-border first:border-t-0 ${w.date === today ? "bg-muted/30" : ""}`}
                    >
                      <td className="px-4 py-3 align-top w-48">
                        <span className="text-foreground">{formatDay(w.date)}</span>
                        {w.date === today && <div className="text-xs text-primary">өнөөдөр</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {selected.map((id) => (
                            <span
                              key={id}
                              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm text-foreground"
                            >
                              {byId.get(id) ? personnelLabel(byId.get(id)!) : "—"}
                              {w.reminded.includes(id) && (
                                <span className="text-xs text-primary" title="«Тайван хоноорой» мэдэгдэл очсон">
                                  ✓
                                </span>
                              )}
                              <button
                                onClick={() => change(w.date, selected.filter((s) => s !== id))}
                                className="text-muted-foreground hover:text-red-400 px-1"
                                aria-label="Хасах"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          <select
                            value=""
                            onChange={(e) => e.target.value && change(w.date, [...selected, e.target.value])}
                            className={selectClass}
                            aria-label={`${formatDay(w.date)}: хүн нэмэх`}
                          >
                            <option value="">+ Хүн нэмэх</option>
                            {available.map((p) => (
                              <option key={p._id} value={p._id}>
                                {personnelLabel(p)}
                                {p.position ? ` — ${p.position}` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="sticky bottom-0 bg-background/95 py-3 border-t border-border flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="px-6 h-10 rounded-md bg-primary text-primary-foreground font-semibold disabled:opacity-50"
        >
          {saving ? "Хадгалж байна..." : "Хадгалах"}
        </button>
        {message && <span className="text-sm text-muted-foreground">{message}</span>}
        {dirty && !message && <span className="text-sm text-yellow-400">Хадгалаагүй өөрчлөлт байна</span>}
      </div>
    </div>
  );
}
