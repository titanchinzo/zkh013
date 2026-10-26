"use client";

import { useEffect, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS, type Role } from "@/lib/roles";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
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
  ["admin", "бүх мэдээ, сургалтын материал, хэрэглэгчийн эрхийг удирдана"],
];

const selectClass = "h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
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

  async function setRole(id: string, role: string) {
    await send(`/api/admin/users/${id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    load();
  }

  async function invite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setInviting(true);
    const ok = await send("/api/admin/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setInviting(false);
    if (!ok) return;
    form.reset();
    setNotice(`${data.email} хаяг руу урилга илгээлээ. Тэр хүн и-мэйл дэх холбоосоор орж нууц үгээ үүсгэнэ.`);
    load();
  }

  async function revoke(inv: InvitationRow) {
    if (!confirm(`${inv.email} хаягийн урилгыг цуцлах уу?`)) return;
    await send(`/api/admin/invitations/${inv.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Хэрэглэгч, хандах эрх</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Шинэ хүнийг и-мэйлээр нь урих, эсвэл бүртгүүлсэн хэрэглэгчийн эрхийг доороос солино.
        </p>
        <ul className="text-sm text-muted-foreground mt-3 space-y-1">
          {ROLE_HELP.map(([role, help]) => (
            <li key={role}>
              <span className="font-semibold text-foreground">{ROLE_LABELS[role]}</span> — {help}
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={invite} className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="font-bold text-foreground">Шинэ хэрэглэгч урих</h2>
        <div className="flex flex-wrap gap-3">
          <Input name="email" type="email" required placeholder="name@example.com" className="flex-1 min-w-60" />
          <select name="role" defaultValue="publisher" className={`${selectClass} h-10`}>
            <option value="publisher">{ROLE_LABELS.publisher}</option>
            <option value="moderator">{ROLE_LABELS.moderator}</option>
            <option value="admin">{ROLE_LABELS.admin}</option>
          </select>
          <button
            type="submit"
            disabled={inviting}
            className="px-4 h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
          >
            {inviting ? "Илгээж байна..." : "Урилга илгээх"}
          </button>
        </div>
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
                          <button
                            onClick={() => revoke(inv)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-md border border-red-400/40 text-red-400"
                          >
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

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Нэр</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-semibold">И-мэйл</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Одоогийн эрх</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Эрх солих</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-4 py-3 text-foreground">
                      {u.name}
                      {u.isMe && <span className="text-muted-foreground"> (та)</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={u.role ? "text-primary font-semibold" : "text-muted-foreground"}>
                        {u.role ? ROLE_LABELS[u.role] : "Эрхгүй"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role ?? "none"}
                        disabled={u.isMe}
                        title={u.isMe ? "Өөрийн эрхийг өөрчлөх боломжгүй" : undefined}
                        onChange={(e) => setRole(u.id, e.target.value)}
                        className={`${selectClass} disabled:opacity-50`}
                      >
                        <option value="none">Эрхгүй</option>
                        <option value="publisher">{ROLE_LABELS.publisher}</option>
                        <option value="moderator">{ROLE_LABELS.moderator}</option>
                        <option value="admin">{ROLE_LABELS.admin}</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
