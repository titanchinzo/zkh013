"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ATTENDANCE_LABELS,
  ATTENDANCE_STATUSES,
  DUTY_LABEL,
  addDays,
  formatDay,
  formatWeek,
  personnelLabel,
  relativeDay,
  todayUb,
  type AttendanceStatus,
} from "@/lib/hr";

type Person = { _id: string; rank: string; name: string; position: string; active: boolean };
type DayData = {
  date: string;
  weekStart: string;
  attendance: Record<string, AttendanceStatus>;
  week: { date: string; duty: string[]; reminded: string[] }[];
  personnel: Person[];
};

const selectClass = "h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground";
const navButton = "h-9 px-3 rounded-md border border-border text-sm text-foreground";

export default function AttendancePage() {
  const [date, setDate] = useState(todayUb);
  const [data, setData] = useState<DayData | null>(null);
  const [duty, setDuty] = useState<Record<string, string[]>>({});
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus | "">>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async (day: string) => {
    const res = await fetch(`/api/hr/days/${day}`);
    const d: DayData = await res.json();
    setData(d);
    setDuty(Object.fromEntries(d.week.map((w) => [w.date, w.duty])));
    setAttendance(d.attendance);
    setDirty(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch the selected day
    load(date);
  }, [date, load]);

  function go(day: string) {
    if (dirty && !confirm("Хадгалаагүй өөрчлөлт байна. Орхих уу?")) return;
    setMessage("");
    setDate(day);
  }

  function edit() {
    setDirty(true);
    setMessage("");
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/hr/days/${date}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendance, duty }),
    });
    setSaving(false);
    if (!res.ok) {
      setMessage((await res.json().catch(() => null))?.error ?? "Алдаа гарлаа");
      return;
    }
    await load(date);
    setMessage("Хадгаллаа. Шинээр томилогдсон хүмүүсийн утсанд мэдэгдэл очно.");
  }

  if (!data) return <p className="text-sm text-muted-foreground">Ачааллаж байна...</p>;

  const today = todayUb();
  const byId = new Map(data.personnel.map((p) => [p._id, p]));
  const onDuty = duty[date] ?? [];
  // Идэвхгүй болсон ч энэ өдөр бүртгэгдсэн хүмүүсийг харуулна
  const rows = data.personnel.filter((p) => p.active || attendance[p._id] || onDuty.includes(p._id));
  const counts = ATTENDANCE_STATUSES.map((s) => [s, rows.filter((p) => attendance[p._id] === s).length] as const);
  const unmarked = rows.filter((p) => !attendance[p._id]).length;

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ирц, харуул хоногийн манаа</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Харуул хоногийн манааг 7 хоногоор гаргаж, өдөр бүрд хүмүүсийг нь сонгоно. Томилогдсон хүнд мэдэгдэл очиж, манаанд гарах
          өдрөө 11 цагаас хойш «Тайван хоноорой» мэдэгдэл авна. Алба хаагчид 7 хоногийн хуваарийг утсандаа харна.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => go(addDays(date, -7))} className={navButton}>
          ◀ 7 хоног
        </button>
        <button onClick={() => go(addDays(date, -1))} className={navButton} aria-label="Өмнөх өдөр">
          ◀
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && go(e.target.value)}
          className={`${selectClass} [color-scheme:dark]`}
        />
        <button onClick={() => go(addDays(date, 1))} className={navButton} aria-label="Дараагийн өдөр">
          ▶
        </button>
        <button onClick={() => go(addDays(date, 7))} className={navButton}>
          7 хоног ▶
        </button>
        <button onClick={() => go(today)} className={navButton}>
          Өнөөдөр
        </button>
      </div>

      <section className="space-y-3">
        <h2 className="font-bold text-foreground">
          {DUTY_LABEL} — {formatWeek(data.weekStart)}
        </h2>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {data.week.map((w) => {
                const selected = duty[w.date] ?? [];
                const available = data.personnel.filter((p) => p.active && !selected.includes(p._id));
                return (
                  <tr key={w.date} className={`border-t border-border first:border-t-0 ${w.date === date ? "bg-muted/30" : ""}`}>
                    <td className="px-4 py-3 align-top w-48">
                      <button onClick={() => go(w.date)} className="text-left text-foreground hover:text-primary">
                        {formatDay(w.date)}
                      </button>
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
                              onClick={() => {
                                setDuty({ ...duty, [w.date]: selected.filter((s) => s !== id) });
                                edit();
                              }}
                              className="text-muted-foreground hover:text-red-400 px-1"
                              aria-label="Хасах"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <select
                          value=""
                          onChange={(e) => {
                            if (!e.target.value) return;
                            setDuty({ ...duty, [w.date]: [...selected, e.target.value] });
                            edit();
                          }}
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
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold text-foreground">
            Ирц — {formatDay(date)} <span className="text-sm font-normal text-muted-foreground">({relativeDay(date, today)})</span>
          </h2>
          <button
            onClick={() => {
              setAttendance({
                ...attendance,
                ...Object.fromEntries(rows.filter((p) => !attendance[p._id]).map((p) => [p._id, "present"])),
              });
              edit();
            }}
            className={navButton}
          >
            Тэмдэглээгүйг «Ирсэн» болгох
          </button>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Stat label="Нийт" value={rows.length} />
          {counts.map(([s, n]) => (
            <Stat key={s} label={ATTENDANCE_LABELS[s]} value={n} />
          ))}
          <Stat label="Тэмдэглээгүй" value={unmarked} muted />
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Алба хаагч бүртгээгүй байна. «Алба хаагчид» хэсгээс нэмнэ үү.</p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {rows.map((p) => (
                  <tr key={p._id} className="border-t border-border first:border-t-0">
                    <td className="px-4 py-2.5 text-foreground">{personnelLabel(p)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.position}</td>
                    <td className="px-4 py-2.5 text-primary text-xs font-semibold">{onDuty.includes(p._id) && "Манаанд"}</td>
                    <td className="px-4 py-2.5 text-right">
                      <select
                        value={attendance[p._id] ?? ""}
                        onChange={(e) => {
                          setAttendance({ ...attendance, [p._id]: e.target.value as AttendanceStatus | "" });
                          edit();
                        }}
                        className={selectClass}
                        aria-label={`${p.name} ирц`}
                      >
                        <option value="">—</option>
                        {ATTENDANCE_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {ATTENDANCE_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
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

function Stat({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <span className="rounded-md border border-border bg-card px-3 py-1.5">
      <span className={muted ? "text-muted-foreground" : "text-foreground font-semibold"}>{value}</span>{" "}
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
