"use client";

import { useEffect, useState, useCallback } from "react";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "moderator" | null;
};

const roleLabel: Record<string, string> = {
  admin: "Админ",
  moderator: "Хянагч",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  async function setRole(id: string, role: string) {
    await fetch(`/api/admin/users/${id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Хэрэглэгч, хандах эрх</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Энд хэрэглэгчдэд Админ эсвэл Хянагч эрх олгож, хандах эрхийг шийднэ.
        </p>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Ачааллаж байна...</p>
      ) : (
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
                  <td className="px-4 py-3 text-foreground">{u.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={u.role ? "text-primary font-semibold" : "text-muted-foreground"}>
                      {u.role ? roleLabel[u.role] : "Эрхгүй"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      defaultValue={u.role ?? "none"}
                      onChange={(e) => setRole(u.id, e.target.value)}
                      className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                    >
                      <option value="none">Эрхгүй</option>
                      <option value="moderator">Хянагч</option>
                      <option value="admin">Админ</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
