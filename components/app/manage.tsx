"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Megaphone, Search, X } from "lucide-react";
import { Screen } from "@/components/app/screen";
import { AlertsPanel } from "@/components/hr/alerts-panel";
import { DUTY_LABEL, addDays, comparePersonnel, formatDay, formatWeek, personnelLabel, todayUb, weekStart } from "@/lib/hr";
import { useDutyWeek, type DutyPerson } from "@/lib/use-duty-week";

// Утсан дээрх аппаас хүний нөөц, админ хийх ажил: харуул хоногийн манаа томилох, зарлан мэдээлэх.
// Бусад (алба хаагч нэмэх, засах, эрх олгох г.м) вэб дээр үлдэнэ. API нь сайтынх (/api/hr/...), утсаар нь танина.

export type ManageView = "duty" | "alerts";

/** «Нүүр» дээрх хүний нөөцийн хэрэгсэл */
export function HrTools({ onOpen }: { onOpen: (view: ManageView) => void }) {
  const tool =
    "flex flex-1 flex-col items-center gap-1.5 rounded-xl border border-border bg-background px-2 py-3 text-sm font-semibold text-foreground active:bg-muted";
  return (
    <section className="space-y-2" aria-label="Хүний нөөцийн хэрэгсэл">
      <h2 className="text-xs font-semibold text-muted-foreground">Хүний нөөц</h2>
      <div className="flex gap-3">
        <button onClick={() => onOpen("duty")} className={tool}>
          <CalendarDays className="size-5 text-primary" aria-hidden />
          Манаа томилох
        </button>
        <button onClick={() => onOpen("alerts")} className={tool}>
          <Megaphone className="size-5 text-primary" aria-hidden />
          Зарлан мэдээлэх
        </button>
      </div>
    </section>
  );
}

export function AlertManager({ onBack }: { onBack: () => void }) {
  return (
    <Screen title="Зарлан мэдээлэх" onBack={onBack}>
      <AlertsPanel />
    </Screen>
  );
}

/** Харуул хоногийн манааны 7 хоногийн хуваарь — өдөр бүрд хүн нэмэх, хасах, хадгалах */
export function DutyManager({ onBack }: { onBack: () => void }) {
  const { start, ready, duty, dirty, saving, message, go, change, save, canLeave } = useDutyWeek();
  // Хүн нэмж буй өдөр
  const [picking, setPicking] = useState<string | null>(null);

  const today = todayUb();
  const thisWeek = weekStart(today);
  const which = start === thisWeek ? "Энэ 7 хоног" : start === addDays(thisWeek, 7) ? "Дараагийн 7 хоног" : "";
  const byId = new Map((ready?.personnel ?? []).map((p) => [p._id, p]));
  const pickingFor = picking ? (duty[picking] ?? []) : [];
  const nav = "flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-foreground active:bg-muted";

  return (
    <Screen title={DUTY_LABEL} onBack={() => canLeave() && onBack()}>
      <p className="text-xs text-muted-foreground">
        Өдөр бүрд хүн нэмж, хасаад «Хадгалах» дарна. Шинээр томилогдсон хүнд мэдэгдэл очиж, манааны өдрөө 11 цагаас хойш
        «Тайван хоноорой» мэдэгдэл авна (✓ — очсон).
      </p>

      <div className="flex items-center gap-2">
        <button onClick={() => go(addDays(start, -7))} className={nav} aria-label="Өмнөх 7 хоног">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-sm font-semibold text-foreground">{which || formatWeek(start)}</p>
          {which && <p className="text-xs text-muted-foreground">{formatWeek(start)}</p>}
        </div>
        <button onClick={() => go(addDays(start, 7))} className={nav} aria-label="Дараагийн 7 хоног">
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>
      {start !== thisWeek && (
        <button onClick={() => go(thisWeek)} className="w-full text-center text-xs font-semibold text-primary">
          Энэ 7 хоног руу буцах
        </button>
      )}

      {!ready ? (
        <p className="text-sm text-muted-foreground">{message?.error ? message.text : "Ачааллаж байна..."}</p>
      ) : (
        <ul className="space-y-2">
          {ready.week.map((w) => {
            const selected = duty[w.date] ?? [];
            return (
              <li
                key={w.date}
                aria-label={formatDay(w.date)}
                className={`space-y-2 rounded-xl border p-3 ${w.date === today ? "border-primary/60 bg-primary/5" : "border-border"} ${w.date < today ? "opacity-60" : ""}`}
              >
                <p className="text-sm font-semibold text-foreground">
                  {formatDay(w.date)}
                  {w.date === today && <span className="ml-2 text-xs font-normal text-primary">өнөөдөр</span>}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {selected.map((id) => {
                    const label = byId.get(id) ? personnelLabel(byId.get(id)!) : "—";
                    return (
                      <span key={id} className="inline-flex items-center gap-1 rounded-full bg-muted py-1 pl-3 pr-1 text-sm text-foreground">
                        {label}
                        {w.reminded.includes(id) && (
                          <span className="text-xs text-primary" aria-label="«Тайван хоноорой» мэдэгдэл очсон">
                            ✓
                          </span>
                        )}
                        <button
                          onClick={() => change(w.date, selected.filter((s) => s !== id))}
                          className="flex size-7 items-center justify-center rounded-full text-muted-foreground active:bg-background"
                          aria-label={`${label}-г хасах`}
                        >
                          <X className="size-4" aria-hidden />
                        </button>
                      </span>
                    );
                  })}
                  <button
                    onClick={() => setPicking(w.date)}
                    className="rounded-full border border-dashed border-border px-3 py-1 text-sm text-primary active:bg-muted"
                  >
                    + Хүн нэмэх
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="sticky bottom-0 -mx-4 space-y-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        {message && ready && (
          <p className={`text-sm ${message.error ? "text-red-400" : "text-primary"}`}>{message.text}</p>
        )}
        {dirty && !message && <p className="text-sm text-yellow-400">Хадгалаагүй өөрчлөлт байна</p>}
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="h-11 w-full rounded-md bg-primary font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Хадгалж байна..." : "Хадгалах"}
        </button>
      </div>

      {picking && ready && (
        <PersonPicker
          title={`${formatDay(picking)}: хүн нэмэх`}
          people={ready.personnel.filter((p) => p.active && !pickingFor.includes(p._id))}
          groups={ready.groups}
          onPick={(id) => {
            change(picking, [...pickingFor, id]);
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </Screen>
  );
}

/** Хайлттай хүн сонгох доод цонх — бүлгээр (захирагчаас эхлэн), бүлэг дотроо цолоор */
function PersonPicker({
  title,
  people,
  groups,
  onPick,
  onClose,
}: {
  title: string;
  people: DutyPerson[];
  groups: string[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  // Хайлтыг өөрөө идэвхжүүлэхгүй — утсан дээр гар нээгдэж жагсаалтыг хаадаг
  const [query, setQuery] = useState("");

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = people
      .filter((p) => !q || `${p.rank} ${p.name} ${p.position} ${p.group ?? ""}`.toLowerCase().includes(q))
      .sort(comparePersonnel(groups));
    const out: { group: string; people: DutyPerson[] }[] = [];
    for (const p of matches) {
      const group = p.group || "Бүлэггүй";
      if (out.at(-1)?.group !== group) out.push({ group, people: [] });
      out.at(-1)!.people.push(p);
    }
    return out;
  }, [people, groups, query]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl border border-border bg-background"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <p className="min-w-0 flex-1 truncate font-semibold text-foreground">{title}</p>
          <button onClick={onClose} aria-label="Хаах" className="flex size-9 items-center justify-center rounded-full active:bg-muted">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <label className="relative mx-4 mt-3 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Нэр, цол, бүлгээр хайх"
            aria-label="Хүн хайх"
            className="h-10 w-full rounded-full border border-border bg-background pl-9 pr-4 text-base text-foreground placeholder:text-muted-foreground"
          />
        </label>
        <div className="mt-2 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {sections.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Олдсонгүй.</p>}
          {sections.map((s) => (
            <div key={s.group} className="pt-3">
              <p className="pb-1 text-xs font-semibold text-muted-foreground">{s.group}</p>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {s.people.map((p) => (
                  <li key={p._id}>
                    <button onClick={() => onPick(p._id)} className="w-full px-3 py-2.5 text-left active:bg-muted">
                      <span className="block text-sm text-foreground">{personnelLabel(p)}</span>
                      {p.position && <span className="block text-xs text-muted-foreground">{p.position}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
