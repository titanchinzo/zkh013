"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Input, Textarea } from "@/components/ui/input";
import { RankSelect } from "@/components/hr/rank-select";
import { GroupSelect, PersonOptions } from "@/components/hr/group-select";
import { comparePersonnel, formatPhone, personnelLabel } from "@/lib/hr";
import type { PlannedRow } from "@/lib/personnel-import";

type Person = {
  _id: string;
  rank: string;
  name: string;
  position: string;
  phone?: string;
  extraPhones?: string[];
  emergencyPhone?: string;
  group?: string;
  photo?: string;
  active: boolean;
  userId?: string;
  canRegister?: boolean;
  seesAllPhones?: boolean;
  invitedByName?: string;
};
type Group = { name: string; count: number; seesAll?: boolean };
type Invitation = { id: string; email: string; invitedByName: string; createdAt: number };
type ImportResult = {
  committed: boolean;
  summary: { total: number; create: number; update: number; same: number; groups: number };
  groups: Group[];
  rows: PlannedRow[];
};

const smallButton = "px-3 py-1.5 text-xs font-semibold rounded-md border border-border text-foreground";
const dangerButton = "px-3 py-1.5 text-xs font-semibold rounded-md border border-red-400/40 text-red-400";
const iconButton = "h-7 w-7 rounded-md border border-border text-xs text-foreground disabled:opacity-30";
const primaryButton = "px-4 h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50";
const selectClass = "h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground";
const NO_GROUP = "\u0000none";

const phonesOf = (p: { phone?: string; extraPhones?: string[] }) => [p.phone, ...(p.extraPhones ?? [])].filter(Boolean) as string[];
const phoneList = (list: string[]) => list.map(formatPhone).join(", ");

/** Нэр, цол, албан тушаал, бүлэг эсвэл утасны дугаараар хайна */
function matches(p: Person, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, "");
  if ([p.rank, p.name, p.position, p.group].join(" ").toLowerCase().includes(q)) return true;
  return digits.length >= 3 && [...phonesOf(p), p.emergencyPhone ?? ""].some((phone) => phone.includes(digits));
}

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
  const [groups, setGroups] = useState<Group[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    const [personnel, invites] = await Promise.all([
      fetch("/api/hr/personnel", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/hr/invitations", { cache: "no-store" }).then((r) => r.json()),
    ]);
    setPeople(personnel.personnel ?? []);
    setGroups(personnel.groups ?? []);
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
    const name = personnelLabel(p);
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

  async function moveGroup(name: string, step: number) {
    const order = groups.map((g) => g.name);
    const from = order.indexOf(name);
    const to = from + step;
    if (from < 0 || to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to], order[from]];
    if (await send("/api/hr/groups", "PUT", { order })) load();
  }

  async function setSeesAll(name: string, seesAll: boolean) {
    if (await send("/api/hr/groups", "PATCH", { name, seesAll })) {
      setNotice(seesAll ? `«${name}» бүлгийнхэн бүх хүний утасны жагсаалтыг харна.` : `«${name}» бүлгийнхэн зөвхөн өөрийн бүлгийнхний утсыг харна.`);
      load();
    }
  }

  async function renameGroup(name: string) {
    const to = prompt(`«${name}» бүлгийн шинэ нэр (байгаа бүлгийн нэр бичвэл нийлнэ):`, name)?.trim();
    if (!to || to === name) return;
    if (await send("/api/hr/groups", "PATCH", { from: name, to })) {
      if (filter === name) setFilter(to);
      load();
    }
  }

  const groupNames = groups.map((g) => g.name);
  const sorted = [...people].sort(comparePersonnel(groupNames));
  const active = sorted.filter((p) => p.active);
  const inactive = sorted.filter((p) => !p.active);
  const unlinked = active.filter((p) => !p.userId);
  const inFilter = (p: Person) => !filter || (filter === NO_GROUP ? !p.group : p.group === filter);
  const visible = active.filter((p) => inFilter(p) && matches(p, query));
  const sections = [...groupNames, ""]
    .map((name) => ({ name, people: visible.filter((p) => (p.group ?? "") === name) }))
    .filter((s) => s.people.length);
  const hiddenInactive = inactive.filter((p) => inFilter(p) && matches(p, query));

  const rowProps = {
    groups: groupNames,
    // «Бүх утас харна» тохиргоотой бүлгүүд — тэдгээрийн хүмүүст тус бүрд нь олгох шаардлагагүй
    allGroups: new Set(groups.filter((g) => g.seesAll).map((g) => g.name)),
    editing,
    onEdit: setEditing,
    onSave: save,
    onUpdate: update,
    onRemove: remove,
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Алба хаагчид</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ирц, харуул хоногийн манаанд сонгогдох алба хаагчид — бүлгээр нь (алба, тасаг, рот…). Мэдээллийн үг үсгийн
          алдааг «Засах»-аар засна. Халагдсан хүнийг «Идэвхгүй болгох»-д ирц, хуваарийн түүх нь үлдэнэ; «Устгах» нь бүр
          мөсөн устгана. «Бүртгэх эрх» олгосон хүн (албадын дарга) утсан дээрх аппаасаа доод хүмүүсээ и-мэйлээр урьж
          бүртгэнэ. «Бүх утас» олгосон хүн аппын «Утас» хэсгээс бүх алба хаагчийн дугаарыг бүлэг бүрээр харна (бүлгийн
          толгой дахь «Бүх утас харна» нь тэр бүлгийн бүх хүнд олгоно).
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
          <select name="personnelId" defaultValue="" className={`${selectClass} w-full`} aria-label="Бүртгэлтэй алба хаагчтай холбох">
            <option value="">Шинэ хүн</option>
            <PersonOptions people={unlinked} groups={groupNames} label={(p) => `Бүртгэлтэй: ${personnelLabel(p)}`} />
          </select>
          <button type="submit" className={primaryButton}>
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
            <GroupSelect groups={groupNames} />
            <Input name="phone" type="tel" inputMode="numeric" required maxLength={16} placeholder="Утасны дугаар" />
            <Input name="extraPhones" inputMode="numeric" maxLength={60} placeholder="Бусад дугаар (заавал биш)" />
            <Input name="emergencyPhone" type="tel" inputMode="numeric" maxLength={16} placeholder="Шаардлагатай үед" />
          </div>
          <button type="submit" className="px-4 h-10 rounded-md border border-border text-sm font-semibold text-foreground">
            Нэмэх
          </button>
        </form>
      </div>

      <ImportPanel
        onImported={(message) => {
          setError("");
          setNotice(message);
          load();
        }}
      />

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
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Нэр, цол, утасны дугаараар хайх"
              aria-label="Алба хаагч хайх"
              className="max-w-sm"
            />
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className={selectClass} aria-label="Бүлгээр шүүх">
              <option value="">Бүх бүлэг ({groups.length})</option>
              {groups.map((g) => (
                <option key={g.name} value={g.name}>
                  {g.name} ({g.count})
                </option>
              ))}
              {active.some((p) => !p.group) && <option value={NO_GROUP}>Бүлэггүй</option>}
            </select>
            <span className="text-sm text-muted-foreground">
              Идэвхтэй: {active.length}
              {visible.length !== active.length && ` · харагдаж буй: ${visible.length}`}
            </span>
          </div>

          {sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">{active.length ? "Хайлтад таарах хүн алга." : "Алба хаагч бүртгээгүй байна."}</p>
          ) : (
            <div className="rounded-xl border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Алба хаагч</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Утас</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Шаардлагатай үед</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Апп</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-semibold" title="Доод хүмүүсээ урьж бүртгэх">
                      Бүртгэх эрх
                    </th>
                    <th
                      className="text-left px-4 py-3 text-muted-foreground font-semibold"
                      title="Утсан дээрх аппад бүх хүний утасны жагсаалтыг (бүлэг бүрээр) харна"
                    >
                      Бүх утас
                    </th>
                    <th />
                  </tr>
                </thead>
                {sections.map((section) => {
                  const index = groupNames.indexOf(section.name);
                  return (
                    <tbody key={section.name || NO_GROUP} data-group={section.name}>
                      <tr className="border-t border-border bg-muted/20">
                        <th colSpan={7} className="px-4 py-2 text-left">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-bold text-foreground">
                              {section.name || "Бүлэггүй"}{" "}
                              <span className="text-xs font-normal text-muted-foreground">({section.people.length})</span>
                            </span>
                            {section.name && (
                              <span className="flex flex-wrap items-center gap-1">
                                <label
                                  className="mr-2 flex items-center gap-1.5 text-xs font-normal text-muted-foreground"
                                  title="Энэ бүлгийнхэн утсан дээрх аппад бүх хүний утасны жагсаалтыг (бүлэг бүрээр) харна"
                                >
                                  <input
                                    type="checkbox"
                                    checked={Boolean(groups.find((g) => g.name === section.name)?.seesAll)}
                                    onChange={(e) => setSeesAll(section.name, e.target.checked)}
                                    className="size-3.5 accent-[var(--primary)]"
                                  />
                                  Бүх утас харна
                                </label>
                                <button
                                  onClick={() => moveGroup(section.name, -1)}
                                  disabled={index <= 0}
                                  className={iconButton}
                                  aria-label={`${section.name}: дээш`}
                                >
                                  ↑
                                </button>
                                <button
                                  onClick={() => moveGroup(section.name, 1)}
                                  disabled={index < 0 || index >= groupNames.length - 1}
                                  className={iconButton}
                                  aria-label={`${section.name}: доош`}
                                >
                                  ↓
                                </button>
                                <button onClick={() => renameGroup(section.name)} className={smallButton}>
                                  Нэр солих
                                </button>
                              </span>
                            )}
                          </div>
                        </th>
                      </tr>
                      {section.people.map((p) => (
                        <PersonRow key={p._id} person={p} {...rowProps} />
                      ))}
                    </tbody>
                  );
                })}
              </table>
            </div>
          )}

          {hiddenInactive.length > 0 && (
            <details className="rounded-xl border border-border">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-muted-foreground">
                Идэвхгүй ({hiddenInactive.length})
              </summary>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {hiddenInactive.map((p) => (
                      <PersonRow key={p._id} person={p} {...rowProps} />
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function PersonRow({
  person: p,
  groups,
  allGroups,
  editing,
  onEdit,
  onSave,
  onUpdate,
  onRemove,
}: {
  person: Person;
  groups: string[];
  allGroups: Set<string>;
  editing: string | null;
  onEdit: (id: string | null) => void;
  onSave: (id: string, e: React.FormEvent<HTMLFormElement>) => void;
  onUpdate: (p: Person, body: Record<string, unknown>, question?: string) => void;
  onRemove: (p: Person) => void;
}) {
  // Бүлгээрээ бүх утсыг харна — тусад нь олгох шаардлагагүй
  const byGroup = Boolean(p.group && allGroups.has(p.group));
  if (editing === p._id) {
    return (
      <tr className="border-t border-border">
        <td colSpan={7} className="px-4 py-3">
          <form onSubmit={(e) => onSave(p._id, e)} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <RankSelect defaultValue={p.rank} />
            <Input name="name" defaultValue={p.name} required maxLength={120} aria-label="Нэр" />
            <Input name="position" defaultValue={p.position} maxLength={120} placeholder="Албан тушаал" />
            <GroupSelect groups={groups} defaultValue={p.group ?? ""} />
            <Input
              name="phone"
              type="tel"
              inputMode="numeric"
              maxLength={16}
              required={Boolean(p.phone)}
              defaultValue={p.phone}
              placeholder="Утасны дугаар"
              aria-label="Утасны дугаар"
            />
            <Input
              name="extraPhones"
              inputMode="numeric"
              maxLength={60}
              defaultValue={(p.extraPhones ?? []).join(", ")}
              placeholder="Бусад дугаар"
              aria-label="Бусад дугаар"
            />
            <Input
              name="emergencyPhone"
              type="tel"
              inputMode="numeric"
              maxLength={16}
              defaultValue={p.emergencyPhone}
              placeholder="Шаардлагатай үед"
              aria-label="Шаардлагатай үед"
            />
            <div className="flex gap-2">
              <button type="submit" className={smallButton}>
                Хадгалах
              </button>
              <button type="button" onClick={() => onEdit(null)} className={smallButton}>
                Болих
              </button>
            </div>
          </form>
          {p.photo && (
            <button
              onClick={() => onUpdate(p, { photo: null }, `${p.name}-ийн профайл зургийг устгах уу?`)}
              className="mt-2 text-xs text-red-400"
            >
              Профайл зургийг устгах
            </button>
          )}
        </td>
      </tr>
    );
  }

  const own = phonesOf(p);
  return (
    <tr className={`border-t border-border ${p.active ? "" : "opacity-50"}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar person={p} />
          <div>
            <p className="text-foreground">
              {personnelLabel(p)}
              {!p.active && <span className="text-muted-foreground"> (идэвхгүй)</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {[p.position, !p.active && p.group, p.invitedByName && `урьсан: ${p.invitedByName}`].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {own.length ? (
          <span className="text-foreground">
            {formatPhone(own[0])}
            {own.length > 1 && <span className="block text-xs text-muted-foreground">{phoneList(own.slice(1))}</span>}
          </span>
        ) : (
          <span className="text-yellow-400">Дугааргүй</span>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{p.emergencyPhone ? formatPhone(p.emergencyPhone) : "—"}</td>
      <td className="px-4 py-3">
        {p.userId ? <span className="text-primary">Холбогдсон</span> : <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={Boolean(p.canRegister)}
          disabled={!p.userId || !p.active}
          title={p.userId ? "Доод хүмүүсээ урьж бүртгэх эрх" : "Аппаа бүртгүүлсэн хүнд л олгоно"}
          onChange={(e) => onUpdate(p, { canRegister: e.target.checked })}
          aria-label={`${p.name} бүртгэх эрх`}
          className="w-4 h-4 accent-[var(--primary)] disabled:opacity-30"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={Boolean(p.seesAllPhones) || byGroup}
          disabled={byGroup || !p.active}
          title={
            byGroup
              ? `«${p.group}» бүлгийнхэн бүгд бүх утсыг харна`
              : "Утсан дээрх аппад бүх хүний утасны жагсаалтыг (бүлэг бүрээр) харна"
          }
          onChange={(e) => onUpdate(p, { seesAllPhones: e.target.checked })}
          aria-label={`${p.name} бүх утас харах`}
          className="w-4 h-4 accent-[var(--primary)] disabled:opacity-30"
        />
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
        <button onClick={() => onEdit(p._id)} className={smallButton}>
          Засах
        </button>
        <button
          onClick={() =>
            onUpdate(
              p,
              { active: !p.active },
              p.active ? `${p.name}-г идэвхгүй болгох уу? Ирц, хуваарийн жагсаалтад гарахгүй болно.` : undefined
            )
          }
          className={smallButton}
        >
          {p.active ? "Идэвхгүй болгох" : "Сэргээх"}
        </button>
        <button onClick={() => onRemove(p)} className={dangerButton}>
          Устгах
        </button>
      </td>
    </tr>
  );
}

/** Ангийн утасны жагсаалтыг (Excel-ээс хуулсан эсвэл CSV/TSV файл) бүлгээр нь бүртгэнэ — эхлээд шалгаад харуулна */
function ImportPanel({ onImported }: { onImported: (message: string) => void }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function readFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const buffer = await file.arrayBuffer();
    let value = new TextDecoder("utf-8").decode(buffer);
    // Excel-ийн энгийн «CSV» нь Windows-1251 кодчилолтой хадгалагддаг
    if (value.includes("�")) value = new TextDecoder("windows-1251").decode(buffer);
    setText(value.replace(/^﻿/, ""));
    setResult(null);
    setError("");
  }

  async function run(commit: boolean) {
    if (commit && result) {
      const question = `${result.summary.create} хүнийг шинээр бүртгэж, ${result.summary.update} хүний мэдээллийг шинэчлэх үү?`;
      if (!confirm(question)) return;
    }
    setBusy(true);
    setError("");
    const res = await fetch("/api/hr/personnel/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, commit }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(data?.error ?? "Алдаа гарлаа");
      return;
    }
    if (commit) {
      setResult(null);
      setText("");
      const s = data.summary;
      onImported(`Жагсаалтаас бүртгэлээ: ${s.create} шинэ, ${s.update} шинэчилсэн, ${s.same} өөрчлөлтгүй — ${s.groups} бүлэг.`);
    } else setResult(data);
  }

  return (
    <details className="rounded-xl border border-border bg-card p-4">
      <summary className="cursor-pointer font-bold text-foreground">Жагсаалтаас бүртгэх (бүлгээр нь)</summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-muted-foreground">
          Ангийн утасны жагсаалтыг Excel-ээс хуулж буулгах эсвэл файлаар (CSV, TSV) оруулна. Мөр бүр: д/д, цол, нэр, өөрийн
          дугаар, шаардлагатай үед. Ганц нүдтэй мөр (алба, тасаг, рот…) бүлэг болж, доорх хүмүүс тэр бүлэгт дарааллаараа орно.
          Аль хэдийн бүртгэлтэй хүн утасны дугаар (эсвэл нэр)-аар танигдаж шинэчлэгдэнэ — давхардахгүй, нэрийг нь өөрчлөхгүй.
          «Шалгах»-аар эхлээд юу болохыг харна.
        </p>
        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
          }}
          placeholder={"Захирагч, орлогч нар\n1\tхур\tН.Нэр\t99112233\t88112233"}
          className="min-h-40 font-mono text-xs"
          aria-label="Жагсаалт"
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className={`${smallButton} cursor-pointer`}>
            Файл сонгох
            <input
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/plain,text/tab-separated-values"
              onChange={readFile}
              className="sr-only"
            />
          </label>
          <button onClick={() => run(false)} disabled={busy || !text.trim()} className={primaryButton}>
            {busy && !result ? "Шалгаж байна..." : "Шалгах"}
          </button>
          {error && <span className="text-sm text-red-400">{error}</span>}
        </div>
        {result && <ImportPreview result={result} busy={busy} onCommit={() => run(true)} />}
      </div>
    </details>
  );
}

const ACTION: Record<PlannedRow["action"], { label: string; className: string }> = {
  create: { label: "Шинэ", className: "text-primary" },
  update: { label: "Шинэчлэх", className: "text-yellow-400" },
  same: { label: "Өөрчлөлтгүй", className: "text-muted-foreground" },
};

function ImportPreview({ result, busy, onCommit }: { result: ImportResult; busy: boolean; onCommit: () => void }) {
  const { summary } = result;
  const warned = result.rows.filter((r) => r.warnings.length);
  const updates = result.rows.filter((r) => r.action === "update");
  const sections = [...(result.rows.some((r) => !r.group) ? [""] : []), ...result.groups.map((g) => g.name)];

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="flex flex-wrap gap-2 text-sm">
        {[
          [summary.total, "хүн"],
          [summary.groups, "бүлэг"],
          [summary.create, "шинэ"],
          [summary.update, "шинэчлэх"],
          [summary.same, "өөрчлөлтгүй"],
        ].map(([value, label]) => (
          <span key={label} className="rounded-md border border-border bg-background px-3 py-1.5">
            <span className="font-semibold text-foreground">{value}</span> <span className="text-muted-foreground">{label}</span>
          </span>
        ))}
      </div>

      {warned.length > 0 && (
        <details open={warned.length <= 20} className="text-sm">
          <summary className="cursor-pointer text-yellow-400">Анхааруулга ({warned.length})</summary>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {warned.map((r) => (
              <li key={r.line}>
                {r.line}-р мөр · {personnelLabel(r)} ({r.group || "бүлэггүй"}): {r.warnings.join("; ")}
              </li>
            ))}
          </ul>
        </details>
      )}

      {updates.length > 0 && (
        <details open className="text-sm">
          <summary className="cursor-pointer text-foreground">Өмнөх бүртгэлтэй таарсан, шинэчлэгдэх ({updates.length})</summary>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {updates.map((r) => (
              <li key={r.line}>
                {personnelLabel(r)} ← <span className="text-foreground">{r.match?.label}</span>: {r.changes.join("; ")}
              </li>
            ))}
          </ul>
        </details>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-foreground">Бүлэг бүрээр ({sections.length})</summary>
        <div className="mt-2 max-h-[32rem] overflow-y-auto rounded-md border border-border">
          <table className="w-full text-xs">
            {sections.map((group) => (
              <tbody key={group || "-"}>
                <tr className="bg-muted/30">
                  <th colSpan={4} className="px-3 py-1.5 text-left font-semibold text-foreground">
                    {group || "Бүлэггүй"} ({result.rows.filter((r) => r.group === group).length})
                  </th>
                </tr>
                {result.rows
                  .filter((r) => r.group === group)
                  .map((r) => (
                    <tr key={r.line} className="border-t border-border">
                      <td className={`px-3 py-1 font-semibold ${ACTION[r.action].className}`}>{ACTION[r.action].label}</td>
                      <td className="px-3 py-1 text-foreground">
                        {personnelLabel(r)}
                        {r.position && <span className="text-muted-foreground"> /{r.position}/</span>}
                      </td>
                      <td className="px-3 py-1 text-muted-foreground">{phoneList(r.phones) || "—"}</td>
                      <td className="px-3 py-1 text-muted-foreground">{r.emergencyPhone ? formatPhone(r.emergencyPhone) : ""}</td>
                    </tr>
                  ))}
              </tbody>
            ))}
          </table>
        </div>
      </details>

      <button onClick={onCommit} disabled={busy || summary.create + summary.update === 0} className={primaryButton}>
        {busy ? "Бүртгэж байна..." : `Бүртгэх — ${summary.create} шинэ, ${summary.update} шинэчлэх`}
      </button>
    </div>
  );
}
