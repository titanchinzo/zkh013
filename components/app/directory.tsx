"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Phone, Search } from "lucide-react";
import { formatPhone } from "@/lib/hr";

// Утсан дээрх аппын утасны жагсаалт: өөрийн бүлгийнхэн, эсвэл (захирагч, орлогч нар г.м) бүх хүн бүлэг бүрээр.
// Дугаар дээр дарахад залгана.

type Entry = {
  id: string;
  rank: string;
  name: string;
  position: string;
  phones: string[];
  emergencyPhone?: string;
  me: boolean;
};
type Data = { scope: "group" | "all"; group: string; groups: { name: string; people: Entry[] }[] };

const label = (p: { rank: string; name: string }) => (p.rank ? `${p.rank} ${p.name}` : p.name);

function matches(p: Entry, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, "");
  if (`${p.rank} ${p.name} ${p.position}`.toLowerCase().includes(q)) return true;
  return digits.length >= 3 && [...p.phones, p.emergencyPhone ?? ""].some((phone) => phone.includes(digits));
}

function Call({ phone }: { phone: string }) {
  return (
    <a
      href={`tel:${phone}`}
      className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-sm font-semibold text-primary active:bg-muted"
    >
      <Phone className="size-3.5" aria-hidden />
      {formatPhone(phone)}
    </a>
  );
}

function Person({ p }: { p: Entry }) {
  return (
    <li className="space-y-1.5 px-3 py-2.5">
      <p className="text-sm text-foreground">
        <span className="font-semibold">{label(p)}</span>
        {p.me && <span className="text-xs text-muted-foreground"> (та)</span>}
        {p.position && <span className="block text-xs text-muted-foreground">{p.position}</span>}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {p.phones.length ? p.phones.map((phone) => <Call key={phone} phone={phone} />) : (
          <span className="text-xs text-muted-foreground">Дугааргүй</span>
        )}
      </div>
      {p.emergencyPhone && (
        <p className="text-xs text-muted-foreground">
          Шаардлагатай үед:{" "}
          <a href={`tel:${p.emergencyPhone}`} className="font-semibold text-primary">
            {formatPhone(p.emergencyPhone)}
          </a>
        </p>
      )}
    </li>
  );
}

export function Directory() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  // Нээлттэй бүлгүүд — анхнаасаа өөрийн бүлэг
  const [open, setOpen] = useState<Set<string> | null>(null);

  useEffect(() => {
    fetch("/api/app/directory", { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok || !body) setError(body?.error ?? "Жагсаалт ачаалж чадсангүй");
        else setData(body);
      })
      .catch(() => setError("Сервертэй холбогдож чадсангүй"));
  }, []);

  if (!data) return <p className="text-sm text-muted-foreground">{error || "Ачааллаж байна..."}</p>;

  const expanded = open ?? new Set([data.group]);
  const toggle = (name: string) => {
    const next = new Set(expanded);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setOpen(next);
  };
  const searching = query.trim().length > 0;
  const sections = data.groups
    .map((g) => ({ ...g, people: g.people.filter((p) => matches(p, query)) }))
    .filter((g) => g.people.length);
  const total = data.groups.reduce((sum, g) => sum + g.people.length, 0);

  return (
    <div className="space-y-4">
      <p className="rounded-md bg-yellow-400/10 px-3 py-2 text-xs text-yellow-300">
        Албан хэрэгцээнд ашиглана. Утасны жагсаалтыг бусдад дамжуулахгүй.
      </p>
      <p className="text-sm text-muted-foreground">
        {data.scope === "all"
          ? `Бүх алба хаагч (${total}) — бүлэг бүрээр`
          : data.group
            ? `Таны бүлэг: ${data.group} (${total})`
            : "Таны бүлэг тодорхойгүй байна — хүний нөөцөд хандана уу."}
      </p>
      {total > 0 && (
        <label className="flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Нэр, цол, дугаараар хайх"
            aria-label="Утасны жагсаалтаас хайх"
            className="h-10 w-full bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </label>
      )}
      {searching && sections.length === 0 && <p className="text-sm text-muted-foreground">Хайлтад таарах хүн алга.</p>}
      {data.scope === "group"
        ? sections.map((g) => (
            <ul key={g.name} className="divide-y divide-border rounded-xl border border-border bg-card">
              {g.people.map((p) => (
                <Person key={p.id} p={p} />
              ))}
            </ul>
          ))
        : sections.map((g) => {
            const shown = searching || expanded.has(g.name);
            return (
              <section key={g.name || "-"} className="overflow-hidden rounded-xl border border-border bg-card" data-group={g.name}>
                <button
                  onClick={() => toggle(g.name)}
                  aria-expanded={shown}
                  className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left"
                >
                  <span className="text-sm font-bold text-foreground">
                    {g.name || "Бүлэггүй"} <span className="font-normal text-muted-foreground">({g.people.length})</span>
                  </span>
                  <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${shown ? "rotate-180" : ""}`} aria-hidden />
                </button>
                {shown && (
                  <ul className="divide-y divide-border border-t border-border">
                    {g.people.map((p) => (
                      <Person key={p.id} p={p} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
    </div>
  );
}
