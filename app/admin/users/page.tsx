"use client";

import { useEffect, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS, type Role } from "@/lib/roles";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  banned: boolean;
  lastSignInAt: number | null;
  isMe: boolean;
};

type InvitationRow = {
  id: string;
  email: string;
  role: Role;
  createdAt: number;
};

const ROLE_HELP: [NonNullable<Role>, string][] = [
  ["publisher", "мэдээ бэлтгэж оруулна, өөрийн нийтлэгдээгүй мэдээг засна"],
  ["moderator", "ирсэн мэдээг хянаж зөвшөөрнө эсвэл татгалзана"],
  ["hr", "алба хаагчдын ирц, харуул хоногийн манаа, утасны бүртгэл, зарлан мэдээллийг удирдана (мэдээтэй ажиллахгүй)"],
  ["admin", "бүх мэдээ, сургалтын материал, хэрэглэгчийн эрхийг удирдана"],
];

const ROLE_OPTIONS = (
  <>
    <option value="none">Эрхгүй (зөвхөн утасны апп)</option>
    <option value="publisher">{ROLE_LABELS.publisher}</option>
    <option value="moderator">{ROLE_LABELS.moderator}</option>
    <option value="hr">{ROLE_LABELS.hr}</option>
    <option value="admin">{ROLE_LABELS.admin}</option>
  </>
);

const selectClass = "h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground";
const smallButton = "px-3 py-1.5 text-xs font-semibold rounded-md border border-border text-foreground disabled:opacity-40";
const dangerButton = "px-3 py-1.5 text-xs font-semibold rounded-md border border-red-400/40 text-red-400 disabled:opacity-40";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users ?? []);
    setInvitations(data.invitations ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  async function send(url: string, init: RequestInit) {
    setError("");
    setNotice("");
    const res = await fetch(url, init);
    if (!res.ok) setError((await res.json().catch(() => null))?.error ?? "Алдаа гарлаа");
    return res.ok;
  }

  const json = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  async function setRole(id: string, role: string) {
    await send(`/api/admin/users/${id}/role`, json("PATCH", { role }));
    load();
  }

  /** «Нэмэх» — бүртгэлийг шууд үүсгэнэ; «Урилга илгээх» — и-мэйлээр урилга явуулна */
  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const mode = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value;
    setAdding(true);
    const ok = await send(mode === "invite" ? "/api/admin/invitations" : "/api/admin/users", json("POST", data));
    setAdding(false);
    if (!ok) return;
    form.reset();
    setNotice(
      mode === "invite"
        ? `${data.email} хаяг руу урилга илгээлээ. Тэр хүн и-мэйл дэх холбоосоор орж бүртгүүлнэ.`
        : `${data.email} нэмэгдлээ. Тэр хүн unit013.mn/sign-in дээр и-мэйлээ бичээд, ирсэн кодоор нэвтэрнэ.`
    );
    load();
  }

  async function revokeInvitation(inv: InvitationRow) {
    if (!confirm(`${inv.email} хаягийн урилгыг цуцлах уу?`)) return;
    await send(`/api/admin/invitations/${inv.id}`, { method: "DELETE" });
    load();
  }

  async function setBanned(u: UserRow, banned: boolean) {
    if (banned && !confirm(`${u.email}-г хаах уу? Тэр хүн нэвтэрч чадахгүй, утасны апп нь ч хаагдана.`)) return;
    if (await send(`/api/admin/users/${u.id}`, json("PATCH", { action: banned ? "ban" : "unban" }))) {
      setNotice(banned ? `${u.email} хаагдлаа.` : `${u.email} дахин нэвтэрч болно. Утасны аппаа дахин бүртгүүлнэ.`);
    }
    load();
  }

  async function remove(u: UserRow) {
    if (!confirm(`${u.email}-г бүр мөсөн устгах уу? Энэ үйлдлийг буцаах боломжгүй.`)) return;
    if (await send(`/api/admin/users/${u.id}`, { method: "DELETE" })) setNotice(`${u.email} устгагдлаа.`);
    load();
  }

  const q = query.trim().toLowerCase();
  const shown = q ? users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q)) : users;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Хэрэглэгч, хандах эрх</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Хэрэглэгч нэмэх, эрхийг нь солих, хаах, устгах. Эрхгүй хэрэглэгч зөвхөн утасны апп ашиглана (хүний нөөцийн
          зөвшөөрлөөр).
        </p>
        <ul className="text-sm text-muted-foreground mt-3 space-y-1">
          {ROLE_HELP.map(([role, help]) => (
            <li key={role}>
              <span className="font-semibold text-foreground">{ROLE_LABELS[role]}</span> — {help}
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={add} className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="font-bold text-foreground">Хэрэглэгч нэмэх</h2>
        <div className="flex flex-wrap gap-3">
          <Input name="email" type="email" required placeholder="name@example.com" className="flex-1 min-w-60" />
          <select name="role" defaultValue="publisher" className={`${selectClass} h-10`} aria-label="Эрх">
            {ROLE_OPTIONS}
          </select>
          <button
            type="submit"
            value="create"
            disabled={adding}
            className="px-4 h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
          >
            Нэмэх
          </button>
          <button
            type="submit"
            value="invite"
            disabled={adding}
            className="px-4 h-10 rounded-md border border-border text-sm font-semibold text-foreground disabled:opacity-50"
          >
            Урилга илгээх
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          «Нэмэх» — бүртгэлийг шууд үүсгэнэ, тэр хүн unit013.mn/sign-in дээр и-мэйлээ бичээд ирсэн кодоор нэвтэрнэ.
          «Урилга илгээх» — и-мэйл рүү нь урилгын холбоос очно.
        </p>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {notice && <p className="text-sm text-primary">{notice}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm">Ачааллаж байна...</p>
      ) : (
        <>
          {invitations.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-bold text-foreground">Хариу хүлээж буй урилга</h2>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {invitations.map((inv) => (
                      <tr key={inv.id} className="border-t border-border first:border-t-0">
                        <td className="px-4 py-3 text-foreground">{inv.email}</td>
                        <td className="px-4 py-3 text-muted-foreground">{inv.role ? ROLE_LABELS[inv.role] : "Эрхгүй"}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(inv.createdAt).toLocaleDateString("mn-MN")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => revokeInvitation(inv)} className={dangerButton}>
                            Цуцлах
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold text-foreground">Хэрэглэгчид ({users.length})</h2>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Нэр, и-мэйлээр хайх"
                className="max-w-72"
              />
            </div>
            <div className="rounded-xl border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Нэр</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-semibold">И-мэйл</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Эрх</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Сүүлд нэвтэрсэн</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((u) => (
                    <tr key={u.id} className={`border-t border-border ${u.banned ? "opacity-60" : ""}`}>
                      <td className="px-4 py-3 text-foreground">
                        {u.name}
                        {u.isMe && <span className="text-muted-foreground"> (та)</span>}
                        {u.banned && <span className="ml-2 text-xs font-semibold text-red-400">Хаагдсан</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role ?? "none"}
                          disabled={u.isMe}
                          title={u.isMe ? "Өөрийн эрхийг өөрчлөх боломжгүй" : undefined}
                          onChange={(e) => setRole(u.id, e.target.value)}
                          className={`${selectClass} disabled:opacity-50`}
                          aria-label={`${u.email} эрх`}
                        >
                          {ROLE_OPTIONS}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleDateString("mn-MN") : "—"}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                        <button onClick={() => setBanned(u, !u.banned)} disabled={u.isMe} className={smallButton}>
                          {u.banned ? "Нээх" : "Хаах"}
                        </button>
                        <button onClick={() => remove(u)} disabled={u.isMe} className={dangerButton}>
                          Устгах
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
