"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ATTENDANCE_LABELS,
  ATTENDANCE_SHORT,
  ATTENDANCE_STATUSES,
  WEEKDAY_SHORT,
  addMonths,
  formatDay,
  formatMonth,
  monthDays,
  personnelLabel,
  relativeDay,
  todayUb,
  weekdayIndex,
  type AttendanceStatus,
} from "@/lib/hr";

type Person = { _id: string; rank: string; name: string; position: string; active: boolean; createdAt: string };
type Day = { date: string; attendance: Record<string, AttendanceStatus>; duty: string[] };
type MonthData = { month: string; days: Day[]; personnel: Person[] };
type Marks = Record<string, AttendanceStatus | "">;

// Төлөв бүрийн өнгө — хуанлийн зурвас, тэмдэг
const STATUS_STYLE: Record<AttendanceStatus, { dot: string; badge: string }> = {
  present: { dot: "bg-green-500", badge: "bg-green-500/15 text-green-300" },
  leave: { dot: "bg-sky-400", badge: "bg-sky-400/15 text-sky-300" },
  sick: { dot: "bg-orange-400", badge: "bg-orange-400/15 text-orange-300" },
  trip: { dot: "bg-violet-400", badge: "bg-violet-400/15 text-violet-300" },
  vacation: { dot: "bg-teal-400", badge: "bg-teal-400/15 text-teal-300" },
  absent: { dot: "bg-red-500", badge: "bg-red-500/15 text-red-300" },
};

const selectClass = "h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground";
const navButton = "h-9 px-3 rounded-md border border-border text-sm text-foreground";

/** Хүний нөөцөд бүртгэгдсэн өдөр (Улаанбаатарын цагаар) — түүнээс өмнөх өдрүүдэд ирц нь шаардлагагүй */
const sinceOf = (p: Person) => (p.createdAt ? todayUb(new Date(p.createdAt)) : "");

/** Тэр өдөр ирц нь бүртгэгдэх ёстой хүмүүс: идэвхтэй (эсвэл тэр өдөр бүртгэгдсэн), тэр өдөр гэхэд бүртгэлтэй болсон */
function expectedOn(date: string, personnel: Person[], marks: Marks) {
  return personnel.filter((p) => marks[p._id] || (p.active && sinceOf(p) <= date));
}

function countOf(marks: Marks) {
  const counts = Object.fromEntries(ATTENDANCE_STATUSES.map((s) => [s, 0])) as Record<AttendanceStatus, number>;
  for (const status of Object.values(marks)) if (status) counts[status]++;
  return counts;
}

export default function AttendancePage() {
  const [month, setMonth] = useState(() => todayUb().slice(0, 7));
  const [selected, setSelected] = useState(todayUb);
  const [person, setPerson] = useState("");
  const [data, setData] = useState<MonthData | null>(null);
  // Сонгосон өдрийн хадгалаагүй өөрчлөлт; null — өөрчлөөгүй
  const [draft, setDraft] = useState<Marks | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const editor = useRef<HTMLElement>(null);

  const load = useCallback(async (m: string) => {
    const res = await fetch(`/api/hr/attendance?month=${m}`, { cache: "no-store" }).catch(() => null);
    if (res?.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch the shown month
    load(month);
  }, [month, load]);

  const leave = () => draft === null || confirm("Хадгалаагүй өөрчлөлт байна. Орхих уу?");

  function pick(date: string, scroll = false) {
    if (date !== selected) {
      if (!leave()) return;
      setDraft(null);
      setMessage("");
      setSelected(date);
      if (date.slice(0, 7) !== month) setMonth(date.slice(0, 7));
    }
    if (scroll) editor.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showMonth(m: string) {
    if (!leave()) return;
    setDraft(null);
    setMessage("");
    setMonth(m);
    const today = todayUb();
    setSelected(today.startsWith(m) ? today : `${m}-01`);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    const res = await fetch(`/api/hr/days/${selected}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendance: draft }),
    });
    setSaving(false);
    if (!res.ok) {
      setMessage((await res.json().catch(() => null))?.error ?? "Алдаа гарлаа");
      return;
    }
    await load(month);
    setDraft(null);
    setMessage("Хадгаллаа.");
  }

  const today = todayUb();
  const ready = data?.month === month ? data : null;
  const personnel = ready?.personnel ?? [];
  const byDate = new Map((ready?.days ?? []).map((d) => [d.date, d]));
  const dates = monthDays(month);
  const chosen = personnel.find((p) => p._id === person);

  const day = byDate.get(selected);
  const values: Marks = draft ?? day?.attendance ?? {};
  // Идэвхгүй болсон ч энэ өдөр бүртгэгдсэн хүмүүсийг харуулна
  const rows = personnel.filter((p) => p.active || values[p._id]);
  const dayCounts = countOf(Object.fromEntries(rows.map((p) => [p._id, values[p._id] ?? ""])));
  const unmarked = rows.filter((p) => !values[p._id]).length;
  const mark = (id: string, status: AttendanceStatus | "") => {
    setDraft({ ...values, [id]: status });
    setMessage("");
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ирц</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Хуанлийн өдөр дээр дарж тэр өдрийн ирцийг тэмдэглэнэ. Нүд бүрд хэдэн хүн ирсэн, хэн чөлөөтэй, өвчтэй г.м
          харагдана. Алба хаагч сонговол тухайн хүний сарын ирц гарна.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => showMonth(addMonths(month, -1))} className={navButton} aria-label="Өмнөх сар">
            ◀
          </button>
          <h2 className="min-w-40 text-center font-bold text-foreground">{formatMonth(month)}</h2>
          <button onClick={() => showMonth(addMonths(month, 1))} className={navButton} aria-label="Дараагийн сар">
            ▶
          </button>
          <button onClick={() => pick(today)} className={navButton}>
            Өнөөдөр
          </button>
        </div>
        <select
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          className={selectClass}
          aria-label="Алба хаагчаар харах"
        >
          <option value="">Бүх алба хаагч</option>
          {personnel.map((p) => (
            <option key={p._id} value={p._id}>
              {personnelLabel(p)}
              {p.active ? "" : " (идэвхгүй)"}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {ATTENDANCE_STATUSES.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${STATUS_STYLE[s].dot}`} />
            {ATTENDANCE_LABELS[s]}
          </span>
        ))}
      </div>

      {chosen && ready && <PersonSummary person={chosen} dates={dates} byDate={byDate} today={today} month={month} />}

      {!ready ? (
        <p className="text-sm text-muted-foreground">Ачааллаж байна...</p>
      ) : (
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAY_SHORT.map((d) => (
            <div key={d} className="px-1 text-xs font-semibold text-muted-foreground">
              {d}
            </div>
          ))}
          {Array.from({ length: weekdayIndex(dates[0]) }, (_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {dates.map((date) => (
            <DayCell
              key={date}
              date={date}
              today={today}
              selected={date === selected}
              marks={byDate.get(date)?.attendance ?? {}}
              personnel={personnel}
              person={person}
              onPick={() => pick(date, true)}
            />
          ))}
        </div>
      )}

      <section ref={editor} className="space-y-3 scroll-mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold text-foreground">
            Ирц — {formatDay(selected)}{" "}
            <span className="text-sm font-normal text-muted-foreground">({relativeDay(selected, today)})</span>
          </h2>
          <button
            onClick={() => {
              setDraft({ ...values, ...Object.fromEntries(rows.filter((p) => !values[p._id]).map((p) => [p._id, "present"])) });
              setMessage("");
            }}
            className={navButton}
          >
            Тэмдэглээгүйг «Ирсэн» болгох
          </button>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Stat label="Нийт" value={rows.length} />
          {ATTENDANCE_STATUSES.map((s) => (
            <Stat key={s} label={ATTENDANCE_LABELS[s]} value={dayCounts[s]} />
          ))}
          <Stat label="Тэмдэглээгүй" value={unmarked} muted />
        </div>
        {!ready ? null : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Алба хаагч бүртгээгүй байна. «Алба хаагчид» хэсгээс нэмнэ үү.</p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {rows.map((p) => (
                  <tr key={p._id} className={`border-t border-border first:border-t-0 ${p._id === person ? "bg-muted/40" : ""}`}>
                    <td className="px-4 py-2.5 text-foreground">{personnelLabel(p)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.position}</td>
                    <td className="px-4 py-2.5 text-primary text-xs font-semibold">
                      {day?.duty.includes(p._id) && "Манаанд"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <select
                        value={values[p._id] ?? ""}
                        onChange={(e) => mark(p._id, e.target.value as AttendanceStatus | "")}
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
          disabled={saving || draft === null}
          className="px-6 h-10 rounded-md bg-primary text-primary-foreground font-semibold disabled:opacity-50"
        >
          {saving ? "Хадгалж байна..." : "Хадгалах"}
        </button>
        {message && <span className="text-sm text-muted-foreground">{message}</span>}
        {draft !== null && !message && <span className="text-sm text-yellow-400">Хадгалаагүй өөрчлөлт байна</span>}
      </div>
    </div>
  );
}

/** Хуанлийн нэг өдөр: бүх хүний ирцийн товч, эсвэл сонгосон нэг хүний төлөв */
function DayCell({
  date,
  today,
  selected,
  marks,
  personnel,
  person,
  onPick,
}: {
  date: string;
  today: string;
  selected: boolean;
  marks: Marks;
  personnel: Person[];
  person: string;
  onPick: () => void;
}) {
  const past = date <= today;
  let body: React.ReactNode = null;

  if (person) {
    const status = marks[person];
    if (status) {
      body = (
        <span className={`mt-1 block rounded px-1.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[status].badge}`}>
          {ATTENDANCE_SHORT[status]}
        </span>
      );
    } else if (past) body = <span className="mt-1 block text-xs text-muted-foreground">—</span>;
  } else if (Object.values(marks).some(Boolean)) {
    const expected = expectedOn(date, personnel, marks);
    const counts = countOf(marks);
    const missing = expected.filter((p) => !marks[p._id]).length;
    body = (
      <>
        <p className="mt-1 text-xs">
          <span className="font-semibold text-green-300">{counts.present}</span>
          <span className="text-muted-foreground">/{expected.length} ирсэн</span>
        </p>
        <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-muted">
          {ATTENDANCE_STATUSES.map((s) =>
            counts[s] ? (
              <span key={s} className={STATUS_STYLE[s].dot} style={{ width: `${(counts[s] / expected.length) * 100}%` }} />
            ) : null
          )}
        </div>
        <ul className="mt-1 space-y-0.5">
          {ATTENDANCE_STATUSES.filter((s) => s !== "present" && counts[s]).map((s) => (
            <li key={s} className="flex items-center gap-1 text-[11px] leading-4 text-muted-foreground">
              <span className={`size-1.5 shrink-0 rounded-full ${STATUS_STYLE[s].dot}`} />
              {ATTENDANCE_SHORT[s]} {counts[s]}
            </li>
          ))}
          {missing > 0 && <li className="text-[11px] leading-4 text-yellow-400">{missing} тэмдэглээгүй</li>}
        </ul>
      </>
    );
  } else if (past) {
    body = <span className="mt-1 block text-[11px] text-muted-foreground">Тэмдэглээгүй</span>;
  }

  return (
    <button
      type="button"
      onClick={onPick}
      title={formatDay(date)}
      data-date={date}
      aria-pressed={selected}
      className={`block w-full min-h-24 rounded-md border p-1.5 text-left align-top transition-colors hover:border-primary/60 ${
        selected ? "border-primary ring-1 ring-primary" : "border-border"
      } ${weekdayIndex(date) >= 5 ? "bg-muted/20" : "bg-card"}`}
    >
      <span
        className={`inline-flex size-6 items-center justify-center rounded-full text-sm font-semibold ${
          date === today ? "bg-primary text-primary-foreground" : "text-foreground"
        }`}
      >
        {Number(date.slice(8))}
      </span>
      {body}
    </button>
  );
}

/** Сонгосон хүний сарын дүн: Ирсэн 18 · Чөлөө 2 · … · Тэмдэглээгүй 3 */
function PersonSummary({
  person,
  dates,
  byDate,
  today,
  month,
}: {
  person: Person;
  dates: string[];
  byDate: Map<string, Day>;
  today: string;
  month: string;
}) {
  const since = sinceOf(person);
  const counts = countOf(Object.fromEntries(dates.map((d) => [d, byDate.get(d)?.attendance[person._id] ?? ""])));
  const unmarked = dates.filter((d) => d <= today && d >= since && !byDate.get(d)?.attendance[person._id]).length;
  const parts = ATTENDANCE_STATUSES.filter((s) => counts[s]).map((s) => `${ATTENDANCE_LABELS[s]} ${counts[s]}`);
  if (unmarked) parts.push(`Тэмдэглээгүй ${unmarked}`);
  return (
    <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
      <span className="font-semibold text-foreground">{personnelLabel(person)}</span>
      {person.position && ` (${person.position})`} — {formatMonth(month)}: {parts.length ? parts.join(" · ") : "бүртгэл алга"}
    </p>
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
