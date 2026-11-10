"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ATTENDANCE_LABELS,
  ATTENDANCE_STATUSES,
  DUTY_LABELS,
  addDays,
  formatDay,
  personnelLabel,
  todayUb,
  type AttendanceStatus,
} from "@/lib/hr";

type Person = { _id: string; rank: string; name: string; position: string; active: boolean };
type DayData = {
  date: string;
  guard: string[];
  watch: string[];
  attendance: Record<string, AttendanceStatus>;
  week: { date: string; guard: string[]; watch: string[] }[];
  personnel: Person[];
};

const selectClass = "h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground";
const navButton = "h-9 px-3 rounded-md border border-border text-sm text-foreground";

export default function AttendancePage() {
  const [date, setDate] = useState(todayUb);
  const [data, setData] = useState<DayData | null>(null);
  const [guard, setGuard] = useState<string[]>([]);
  const [watch, setWatch] = useState<string[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus | "">>({});
  const [guardWeek, setGuardWeek] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async (day: string) => {
    const res = await fetch(`/api/hr/days/${day}`);
    const d: DayData = await res.json();
    setData(d);
    setGuard(d.guard);
    setWatch(d.watch);
    setAttendance(d.attendance);
    setGuardWeek(false);
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

  function change<T>(setter: (v: T) => void, value: T) {
    setter(value);
    setDirty(true);
    setMessage("");
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/hr/days/${date}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guard, watch, attendance, guardWeek }),
    });
    setSaving(false);
    if (!res.ok) {
      setMessage((await res.json().catch(() => null))?.error ?? "Алдаа гарлаа");
      return;
    }
    await load(date);
    setMessage("Хадгаллаа.");
  }

  if (!data) return <p className="text-sm text-muted-foreground">Ачааллаж байна...</p>;

  const byId = new Map(data.personnel.map((p) => [p._id, p]));
  const nameOf = (id: string) => (byId.get(id) ? personnelLabel(byId.get(id)!) : "—");
  // Идэвхгүй болсон ч энэ өдөр бүртгэгдсэн хүмүүсийг харуулна
  const rows = data.personnel.filter((p) => p.active || attendance[p._id] || guard.includes(p._id) || watch.includes(p._id));
  const counts = ATTENDANCE_STATUSES.map((s) => [s, rows.filter((p) => attendance[p._id] === s).length] as const);
  const unmarked = rows.filter((p) => !attendance[p._id]).length;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ирц, харуул, манаа</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Өдөр бүрийн ирц, 7 хоногийн харуул, хоногийн манааг энд тэмдэглэнэ. Томилогдсон хүний утсанд мэдэгдэл очно.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
        <button onClick={() => go(todayUb())} className={navButton}>
          Өнөөдөр
        </button>
        <span className="text-foreground font-semibold ml-2">{formatDay(date)}</span>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Stat label="Нийт" value={rows.length} />
        {counts.map(([s, n]) => (
          <Stat key={s} label={ATTENDANCE_LABELS[s]} value={n} />
        ))}
        <Stat label="Тэмдэглээгүй" value={unmarked} muted />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DutyPicker
          title={DUTY_LABELS.guard}
          selected={guard}
          people={data.personnel}
          onChange={(v) => change(setGuard, v)}
        >
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={guardWeek} onChange={(e) => change(setGuardWeek, e.target.checked)} />
            Дараагийн 6 өдөрт ч мөн оноох ({formatDay(date)} – {formatDay(addDays(date, 6))})
          </label>
        </DutyPicker>
        <DutyPicker
          title={DUTY_LABELS.watch}
          selected={watch}
          people={data.personnel}
          onChange={(v) => change(setWatch, v)}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-foreground">Ирц</h2>
          <button
            onClick={() =>
              change(setAttendance, {
                ...attendance,
                ...Object.fromEntries(rows.filter((p) => !attendance[p._id]).map((p) => [p._id, "present"])),
              })
            }
            className={navButton}
          >
            Тэмдэглээгүйг «Ирсэн» болгох
          </button>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Алба хаагч бүртгээгүй байна. «Алба хаагчид» хэсгээс нэмнэ үү.
          </p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {rows.map((p) => (
                  <tr key={p._id} className="border-t border-border first:border-t-0">
                    <td className="px-4 py-2.5 text-foreground">{personnelLabel(p)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.position}</td>
                    <td className="px-4 py-2.5 text-primary text-xs font-semibold">
                      {[guard.includes(p._id) && "Харуул", watch.includes(p._id) && "Манаа"].filter(Boolean).join(", ")}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <select
                        value={attendance[p._id] ?? ""}
                        onChange={(e) =>
                          change(setAttendance, { ...attendance, [p._id]: e.target.value as AttendanceStatus | "" })
                        }
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
      </div>

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

      <div className="space-y-3">
        <h2 className="font-bold text-foreground">Ойрын 7 хоногийн хуваарь</h2>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-semibold">Өдөр</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-semibold">Харуул</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-semibold">Манаа</th>
              </tr>
            </thead>
            <tbody>
              {data.week.map((d) => (
                <tr
                  key={d.date}
                  onClick={() => go(d.date)}
                  className={`border-t border-border cursor-pointer hover:bg-muted/40 ${d.date === date ? "bg-muted/30" : ""}`}
                >
                  <td className="px-4 py-2.5 text-foreground whitespace-nowrap">{formatDay(d.date)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{d.guard.map(nameOf).join(", ") || "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{d.watch.map(nameOf).join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

function DutyPicker({
  title,
  selected,
  people,
  onChange,
  children,
}: {
  title: string;
  selected: string[];
  people: Person[];
  onChange: (ids: string[]) => void;
  children?: React.ReactNode;
}) {
  const byId = new Map(people.map((p) => [p._id, p]));
  const available = people.filter((p) => p.active && !selected.includes(p._id));
  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h2 className="font-bold text-foreground">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {selected.length === 0 && <span className="text-sm text-muted-foreground">Хүн сонгоогүй</span>}
        {selected.map((id) => (
          <span key={id} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm text-foreground">
            {byId.get(id) ? personnelLabel(byId.get(id)!) : "—"}
            <button
              onClick={() => onChange(selected.filter((s) => s !== id))}
              className="text-muted-foreground hover:text-red-400 px-1"
              aria-label="Хасах"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <select
        value=""
        onChange={(e) => e.target.value && onChange([...selected, e.target.value])}
        className={`${selectClass} w-full`}
        aria-label={`${title}: хүн нэмэх`}
      >
        <option value="">+ Хүн нэмэх</option>
        {available.map((p) => (
          <option key={p._id} value={p._id}>
            {personnelLabel(p)}
            {p.position ? ` — ${p.position}` : ""}
          </option>
        ))}
      </select>
      {children}
    </section>
  );
}
