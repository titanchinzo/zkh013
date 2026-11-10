"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { RankSelect } from "@/components/hr/rank-select";

type Person = { _id: string; rank: string; name: string; position: string; active: boolean; userId?: string };

const smallButton = "px-3 py-1.5 text-xs font-semibold rounded-md border border-border text-foreground";

export default function PersonnelPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/hr/personnel");
    setPeople((await res.json()).personnel ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  async function send(url: string, method: string, body: unknown) {
    setError("");
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) setError((await res.json().catch(() => null))?.error ?? "Алдаа гарлаа");
    return res.ok;
  }

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (await send("/api/hr/personnel", "POST", Object.fromEntries(new FormData(form)))) {
      form.reset();
      load();
    }
  }

  async function save(id: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (await send(`/api/hr/personnel/${id}`, "PATCH", Object.fromEntries(new FormData(e.currentTarget)))) {
      setEditing(null);
      load();
    }
  }

  async function setActive(p: Person, active: boolean) {
    if (!active && !confirm(`${p.name}-г идэвхгүй болгох уу? Ирц, харуул, манааны жагсаалтад гарахгүй болно.`)) return;
    if (await send(`/api/hr/personnel/${p._id}`, "PATCH", { active })) load();
  }

  const active = people.filter((p) => p.active);
  const inactive = people.filter((p) => !p.active);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Алба хаагчид</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ирц, харуул, манаанд сонгогдох алба хаагчид. Утсаа бүртгүүлсэн хүн «Утасны бүртгэл»-ээс зөвшөөрөхөд энд нэмэгдэнэ
          эсвэл холбогдоно.
        </p>
      </div>

      <form onSubmit={add} className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="font-bold text-foreground">Алба хаагч нэмэх</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr_2fr_auto]">
          <RankSelect />
          <Input name="name" placeholder="Овог, нэр" required maxLength={120} />
          <Input name="position" placeholder="Албан тушаал" maxLength={120} />
          <button type="submit" className="px-4 h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold">
            Нэмэх
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Ачааллаж байна...</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Идэвхтэй: {active.length}</p>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Цол</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Овог, нэр</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Албан тушаал</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Утас</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...active, ...inactive].map((p) =>
                  editing === p._id ? (
                    <tr key={p._id} className="border-t border-border">
                      <td colSpan={5} className="px-4 py-3">
                        <form onSubmit={(e) => save(p._id, e)} className="grid gap-2 sm:grid-cols-[1fr_2fr_2fr_auto_auto]">
                          <RankSelect defaultValue={p.rank} />
                          <Input name="name" defaultValue={p.name} required maxLength={120} />
                          <Input name="position" defaultValue={p.position} maxLength={120} />
                          <button type="submit" className={smallButton}>
                            Хадгалах
                          </button>
                          <button type="button" onClick={() => setEditing(null)} className={smallButton}>
                            Болих
                          </button>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <tr key={p._id} className={`border-t border-border ${p.active ? "" : "opacity-50"}`}>
                      <td className="px-4 py-3 text-muted-foreground">{p.rank}</td>
                      <td className="px-4 py-3 text-foreground">
                        {p.name}
                        {!p.active && <span className="text-muted-foreground"> (идэвхгүй)</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.position}</td>
                      <td className="px-4 py-3">
                        {p.userId ? <span className="text-primary">Холбогдсон</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                        <button onClick={() => setEditing(p._id)} className={smallButton}>
                          Засах
                        </button>
                        <button onClick={() => setActive(p, !p.active)} className={smallButton}>
                          {p.active ? "Идэвхгүй болгох" : "Сэргээх"}
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
