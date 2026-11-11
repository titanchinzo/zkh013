"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { RankSelect } from "@/components/hr/rank-select";
import { formatPhone } from "@/lib/hr";

type Person = {
  _id: string;
  rank: string;
  name: string;
  position: string;
  phone?: string;
  photo?: string;
  active: boolean;
  userId?: string;
  canRegister?: boolean;
  invitedByName?: string;
};
type Invitation = { id: string; email: string; invitedByName: string; createdAt: number };

const smallButton = "px-3 py-1.5 text-xs font-semibold rounded-md border border-border text-foreground";
const dangerButton = "px-3 py-1.5 text-xs font-semibold rounded-md border border-red-400/40 text-red-400";
const phoneInput = { name: "phone", type: "tel", inputMode: "numeric" as const, required: true, maxLength: 16 };

function Avatar({ person }: { person: Person }) {
  return person.photo ? (
    <Image src={person.photo} alt="" width={32} height={32} unoptimized className="w-8 h-8 rounded-full object-cover" />
  ) : (
    <span className="w-8 h-8 rounded-full bg-muted text-xs font-bold text-foreground flex items-center justify-center">
      {person.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

export default function PersonnelPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [personnel, invites] = await Promise.all([
      fetch("/api/hr/personnel").then((r) => r.json()),
      fetch("/api/hr/invitations").then((r) => r.json()),
    ]);
    setPeople(personnel.personnel ?? []);
    setInvitations(invites.invitations ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  async function send(url: string, method: string, body?: unknown) {
    setError("");
    setNotice("");
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
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

  async function invite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    if (await send("/api/hr/invitations", "POST", { email: data.email, personnelId: data.personnelId || undefined })) {
      form.reset();
      setNotice(`${data.email} руу урилга илгээлээ. Тэр хүн и-мэйл дэх холбоосоор орж бүртгэлээ шууд үүсгэнэ.`);
      load();
    }
  }

  async function cancelInvitation(inv: Invitation) {
    if (!confirm(`${inv.email}-ийн урилгыг цуцлах уу?`)) return;
    if (await send(`/api/hr/invitations/${inv.id}`, "DELETE")) load();
  }

  async function save(id: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (await send(`/api/hr/personnel/${id}`, "PATCH", Object.fromEntries(new FormData(e.currentTarget)))) {
      setEditing(null);
      load();
    }
  }

  async function update(p: Person, body: Record<string, unknown>, question?: string) {
    if (question && !confirm(question)) return;
    if (await send(`/api/hr/personnel/${p._id}`, "PATCH", body)) load();
  }

  async function remove(p: Person) {
    const name = [p.rank, p.name].filter(Boolean).join(" ");
    const question = [
      `${name}-г бүр мөсөн устгах уу? Буцаах боломжгүй.`,
      "Ирц, харуулын хуваарийн түүх нь хамт устна.",
      p.userId ? "Утасны апп нь хаагдаж, дахин бүртгүүлэхэд хүний нөөцийн зөвшөөрөл хэрэгтэй болно." : "",
      "Халагдсан хүний түүхийг үлдээх бол «Идэвхгүй болгох»-ыг ашиглана уу.",
    ]
      .filter(Boolean)
      .join("\n\n");
    if (!confirm(question)) return;
    if (await send(`/api/hr/personnel/${p._id}`, "DELETE")) {
      setNotice(`${name}-г устгалаа.`);
      load();
    }
  }

  const active = people.filter((p) => p.active);
  const inactive = people.filter((p) => !p.active);
  const unlinked = active.filter((p) => !p.userId);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Алба хаагчид</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ирц, харуул хоногийн манаанд сонгогдох алба хаагчид. Мэдээллийн үг үсгийн алдааг «Засах»-аар засна.
          Халагдсан хүнийг «Идэвхгүй болгох»-д ирц, хуваарийн түүх нь үлдэнэ; «Устгах» нь бүр мөсөн устгана.
          «Бүртгэх эрх» олгосон хүн (албадын дарга) утсан дээрх аппаасаа доод хүмүүсээ и-мэйлээр урьж бүртгэнэ.
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Урилга заавал биш: аппаа татсан хүн өөрөө хүсэлт илгээж, түүнийг{" "}
          <Link href="/admin/devices" className="text-primary hover:underline">
            «Утасны бүртгэл»
          </Link>
          -ээс зөвшөөрнө. Энд урьдчилж бүртгэсэн бол утасны дугаар, нэрээр нь таарах бүртгэлийг санал болгоно.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={invite} className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="font-bold text-foreground">И-мэйлээр урих</h2>
          <p className="text-xs text-muted-foreground">
            Урилгаар орж ирсэн хүн аппаа татаж, бүртгэлээ (утас, зураг) өөрөө шууд үүсгэнэ. Доороос сонгосон, эсвэл
            утасны дугаар нь таарсан бүртгэлтэй алба хаагчтай холбогдоно.
          </p>
          <Input name="email" type="email" required placeholder="name@example.com" />
          <select
            name="personnelId"
            defaultValue=""
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
            aria-label="Бүртгэлтэй алба хаагчтай холбох"
          >
            <option value="">Шинэ хүн</option>
            {unlinked.map((p) => (
              <option key={p._id} value={p._id}>
                Бүртгэлтэй: {[p.rank, p.name].filter(Boolean).join(" ")}
              </option>
            ))}
          </select>
          <button type="submit" className="px-4 h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold">
            Урилга илгээх
          </button>
        </form>

        <form onSubmit={add} className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="font-bold text-foreground">Гараар нэмэх</h2>
          <p className="text-xs text-muted-foreground">
            Ирц, хуваарьт урьдчилж оруулна. Тэр хүн дараа нь аппаа суулгаж ижил утасны дугаараар бүртгүүлэхэд энэ
            бүртгэлтэй нь холбогдоно — давхардахгүй.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <RankSelect />
            <Input name="name" placeholder="Овог, нэр" required maxLength={120} />
            <Input name="position" placeholder="Албан тушаал" maxLength={120} />
            <Input {...phoneInput} placeholder="Утасны дугаар" />
          </div>
          <button type="submit" className="px-4 h-10 rounded-md border border-border text-sm font-semibold text-foreground">
            Нэмэх
          </button>
        </form>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {notice && <p className="text-sm text-primary">{notice}</p>}

      {invitations.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-bold text-foreground">Хариу хүлээж буй урилга ({invitations.length})</h2>
          <ul className="rounded-xl border border-border divide-y divide-border text-sm">
            {invitations.map((inv) => (
              <li key={inv.id} className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
                <span className="text-foreground">{inv.email}</span>
                <span className="flex items-center gap-3 text-xs text-muted-foreground">
                  Урьсан: {inv.invitedByName} · {new Date(inv.createdAt).toLocaleDateString("mn-MN")}
                  <button onClick={() => cancelInvitation(inv)} className="text-red-400">
                    Цуцлах
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Ачааллаж байна...</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Идэвхтэй: {active.length}</p>
          <div className="rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Алба хаагч</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Утас</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Апп</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-semibold" title="Доод хүмүүсээ урьж бүртгэх">
                    Бүртгэх эрх
                  </th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...active, ...inactive].map((p) =>
                  editing === p._id ? (
                    <tr key={p._id} className="border-t border-border">
                      <td colSpan={5} className="px-4 py-3">
                        <form onSubmit={(e) => save(p._id, e)} className="grid gap-2 sm:grid-cols-[1fr_2fr_2fr_1.5fr_auto_auto]">
                          <RankSelect defaultValue={p.rank} />
                          <Input name="name" defaultValue={p.name} required maxLength={120} />
                          <Input name="position" defaultValue={p.position} maxLength={120} placeholder="Албан тушаал" />
                          <Input {...phoneInput} defaultValue={p.phone} placeholder="Утасны дугаар" />
                          <button type="submit" className={smallButton}>
                            Хадгалах
                          </button>
                          <button type="button" onClick={() => setEditing(null)} className={smallButton}>
                            Болих
                          </button>
                        </form>
                        {p.photo && (
                          <button
                            onClick={() => update(p, { photo: null }, `${p.name}-ийн профайл зургийг устгах уу?`)}
                            className="mt-2 text-xs text-red-400"
                          >
                            Профайл зургийг устгах
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    <tr key={p._id} className={`border-t border-border ${p.active ? "" : "opacity-50"}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar person={p} />
                          <div>
                            <p className="text-foreground">
                              {[p.rank, p.name].filter(Boolean).join(" ")}
                              {!p.active && <span className="text-muted-foreground"> (идэвхгүй)</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {[p.position, p.invitedByName && `урьсан: ${p.invitedByName}`].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {p.phone ? (
                          <span className="text-foreground">{formatPhone(p.phone)}</span>
                        ) : (
                          <span className="text-yellow-400">Дугааргүй</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {p.userId ? <span className="text-primary">Холбогдсон</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(p.canRegister)}
                          disabled={!p.userId || !p.active}
                          title={p.userId ? "Доод хүмүүсээ урьж бүртгэх эрх" : "Аппаа бүртгүүлсэн хүнд л олгоно"}
                          onChange={(e) => update(p, { canRegister: e.target.checked })}
                          aria-label={`${p.name} бүртгэх эрх`}
                          className="w-4 h-4 accent-[var(--primary)] disabled:opacity-30"
                        />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                        <button onClick={() => setEditing(p._id)} className={smallButton}>
                          Засах
                        </button>
                        <button
                          onClick={() =>
                            update(
                              p,
                              { active: !p.active },
                              p.active ? `${p.name}-г идэвхгүй болгох уу? Ирц, хуваарийн жагсаалтад гарахгүй болно.` : undefined
                            )
                          }
                          className={smallButton}
                        >
                          {p.active ? "Идэвхгүй болгох" : "Сэргээх"}
                        </button>
                        <button onClick={() => remove(p)} className={dangerButton}>
                          Устгах
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
