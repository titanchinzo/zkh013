"use client";

import { useCallback, useEffect, useState } from "react";
import { PersonOptions } from "@/components/hr/group-select";
import { POLL_MS } from "@/lib/chat-shared";
import { formatDateTime, formatPhone, personnelLabel } from "@/lib/hr";
import { usePolling } from "@/lib/use-polling";

// Утсан дээрх апп (хүний нөөц, админ): утас бүртгүүлэх хүсэлтүүдийг энд шууд зөвшөөрнө/татгалзана — сайтын «Утасны бүртгэл»
// хуудас руу орох шаардлагагүй. Шинэ хүсэлт ирэхэд мэдэгдэл очиж, дарахад апп нээгдэнэ.

type Request = {
  id: string;
  userId: string;
  email: string;
  rank: string;
  name: string;
  position: string;
  phone: string;
  label: string;
  createdAt: string;
  suggestedId: string | null;
  why: string | null;
};
type Person = {
  _id: string;
  rank: string;
  name: string;
  position: string;
  group?: string;
  phone?: string;
  userId?: string;
};
type Data = { requests: Request[]; personnel: Person[]; groups: string[] };

/**
 * Шийдвэр хүлээж буй утасны хүсэлтүүд. Хүсэлт байхгүй бол юу ч харуулахгүй. onCount — хүсэлтийн тоо (цэсний тэмдэгт),
 * onChange — шийдвэр гарсны дараа (нүүр хуудсыг шинэчлэхэд).
 */
export function DeviceRequests({ onCount, onChange }: { onCount: (count: number) => void; onChange: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  // Хүний нөөцийн сонгосон алба хаагч (хүсэлтийн id → personnelId); сонгоогүй бол санал болгосон, үгүй бол «шинээр»
  const [chosen, setChosen] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/app/device-requests", { cache: "no-store" }).catch(() => null);
    // Сүлжээ тасарсан үед өмнөх жагсаалтаа хэвээр үлдээнэ
    if (!res?.ok) return;
    const next: Data = await res.json();
    setData(next);
    onCount(next.requests.length);
  }, [onCount]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);
  // Нүүр хуудас нээлттэй байхад шинэ хүсэлт өөрөө гарч ирнэ
  usePolling(load, POLL_MS.home);

  async function decide(r: Request, action: "approve" | "reject", personnelId: string) {
    const who = personnelLabel(r);
    if (!confirm(action === "approve" ? `${who}-ийн утсыг зөвшөөрөх үү?` : `${who}-ийн хүсэлтийг татгалзах уу?`)) return;
    setBusy(r.id);
    setError("");
    const res = await fetch(`/api/app/device-requests/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...(action === "approve" ? { personnelId } : {}) }),
    }).catch(() => null);
    setBusy(null);
    if (!res?.ok) setError((await res?.json().catch(() => null))?.error ?? "Сервертэй холбогдож чадсангүй");
    await load();
    onChange();
  }

  if (!data || data.requests.length === 0) return null;

  return (
    <section className="space-y-3" aria-label="Утасны хүсэлт">
      <h2 className="font-bold text-foreground">Утасны хүсэлт ({data.requests.length})</h2>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {data.requests.map((r) => {
        const personnelId = chosen[r.id] ?? r.suggestedId ?? "new";
        const choices = data.personnel.filter((p) => !p.userId || p.userId === r.userId);
        return (
          <div key={r.id} className="space-y-3 rounded-xl border border-primary/50 bg-primary/10 p-4">
            <div className="space-y-0.5">
              <p className="font-bold text-foreground">{personnelLabel(r)}</p>
              <p className="text-sm text-muted-foreground">
                {[r.position, formatPhone(r.phone), r.email].filter(Boolean).join(" · ")}
              </p>
              <p className="text-xs text-muted-foreground">
                {r.label} · {formatDateTime(r.createdAt)}
              </p>
              <p className={`text-xs ${r.suggestedId ? "text-primary" : "text-muted-foreground"}`}>
                {r.why
                  ? `✓ ${r.why}`
                  : "Хүний нөөцийн бүртгэлээс олдсонгүй — шинээр бүртгэх эсвэл жагсаалтаас сонгоно уу"}
              </p>
            </div>
            <select
              value={personnelId}
              onChange={(e) => setChosen((current) => ({ ...current, [r.id]: e.target.value }))}
              aria-label={`${personnelLabel(r)}: алба хаагчтай холбох`}
              className="h-11 w-full rounded-md border border-border bg-background px-2 text-base text-foreground"
            >
              <option value="new">Шинэ алба хаагчаар бүртгэх</option>
              <PersonOptions
                people={choices}
                groups={data.groups}
                label={(p) =>
                  `${personnelLabel(p)}${p.position ? ` — ${p.position}` : ""}${p.phone ? ` · ${formatPhone(p.phone)}` : ""}`
                }
              />
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => decide(r, "approve", personnelId)}
                disabled={busy === r.id}
                className="h-11 flex-1 rounded-md bg-primary font-semibold text-primary-foreground disabled:opacity-50"
              >
                Зөвшөөрөх
              </button>
              <button
                onClick={() => decide(r, "reject", personnelId)}
                disabled={busy === r.id}
                className="h-11 flex-1 rounded-md border border-border font-semibold text-foreground disabled:opacity-50"
              >
                Татгалзах
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
