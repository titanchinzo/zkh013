"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { formatPhone, personnelLabel, sameName } from "@/lib/hr";
import { PersonOptions } from "@/components/hr/group-select";
import { usePolling } from "@/lib/use-polling";

type DeviceRow = {
  _id: string;
  userId: string;
  email: string;
  rank: string;
  name: string;
  position: string;
  phone?: string;
  label: string;
  status: "pending" | "approved" | "rejected" | "revoked";
  createdAt: string;
  decidedAt?: string;
  lastSeenAt?: string;
  pushEnabled?: boolean;
};
type Person = {
  _id: string;
  rank: string;
  name: string;
  position: string;
  group?: string;
  phone?: string;
  extraPhones?: string[];
  userId?: string;
};
type Data = { pending: DeviceRow[]; approved: DeviceRow[]; history: DeviceRow[]; personnel: Person[]; groups: string[] };

const smallButton = "px-3 py-1.5 text-xs font-semibold rounded-md border border-border text-foreground";
const dangerButton = "px-3 py-1.5 text-xs font-semibold rounded-md border border-red-400/40 text-red-400";
const fmt = (d?: string) => (d ? new Date(d).toLocaleString("mn-MN") : "—");

export default function DevicesPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/hr/devices", { cache: "no-store" }).catch(() => null);
    // Сүлжээ тасарсан, сервер дахин ачаалж буй үед өмнөх жагсаалтаа хэвээр үлдээнэ
    if (res?.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  // Шинэ хүсэлт хуудсыг дахин ачаалахгүйгээр гарч ирнэ — олон хүн зэрэг бүртгүүлж байхад
  usePolling(load, 15_000);

  async function decide(id: string, body: Record<string, unknown>) {
    setError("");
    const res = await fetch(`/api/hr/devices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) setError((await res.json().catch(() => null))?.error ?? "Алдаа гарлаа");
    load();
  }

  function revoke(d: DeviceRow) {
    if (!confirm(`${d.name}-ийн утсыг (${d.label}) хүчингүй болгох уу? Тэр утсанд зарлан мэдээлэл очихгүй болно.`)) return;
    const signOut = confirm("Утсаа гээсэн бол: тэр хүнийг сайтын бүх нэвтрэлтээс мөн гаргах уу?");
    decide(d._id, { action: "revoke", signOut });
  }

  if (!data) return <p className="text-sm text-muted-foreground">Ачааллаж байна...</p>;

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Утасны бүртгэл</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Аппыг утсандаа суулгасан хүн урилгагүйгээр энд хүсэлт илгээнэ — хүний нөөцөд урьдчилж бүртгэсэн бол
          утасны дугаар, нэрээр нь таарах бүртгэлийг санал болгоно, үгүй бол шинээр бүртгэнэ. Зөвшөөрмөгц тэр хүний
          апп нээгдэнэ. Хүн бүр нэг л утастай — шинэ утсыг зөвшөөрөхөд хуучин утас нь автоматаар хүчингүй болно.
          Гээсэн утсыг доороос хүчингүй болгоно.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
        <Image src="/app-qr.png" alt="unit013.mn/download хаягийн QR код" width={96} height={96} className="rounded-md shrink-0" />
        <div className="text-sm text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">Апп татах холбоос</p>
          <p>
            Алба хаагчид энэ QR кодыг утасныхаа камераар уншуулах эсвэл{" "}
            <span className="font-mono text-foreground">unit013.mn/download</span> хаягийг нээж аппаа суулгана.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <section className="space-y-3">
        <h2 className="font-bold text-foreground">Шийдвэр хүлээж буй хүсэлт ({data.pending.length})</h2>
        {data.pending.length === 0 && <p className="text-sm text-muted-foreground">Хүсэлт алга.</p>}
        {data.pending.map((d) => (
          <PendingRequest
            key={d._id}
            device={d}
            personnel={data.personnel}
            groups={data.groups ?? []}
            onDecide={(body) => decide(d._id, body)}
          />
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-bold text-foreground">Зөвшөөрөгдсөн утас ({data.approved.length})</h2>
        {data.approved.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-semibold">Алба хаагч</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-semibold">Утас</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-semibold">Мэдэгдэл</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-semibold">Сүүлд нээсэн</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.approved.map((d) => (
                  <tr key={d._id} className="border-t border-border">
                    <td className="px-4 py-2.5 text-foreground">
                      {personnelLabel(d)}
                      <div className="text-xs text-muted-foreground">{d.email}</div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{d.label}</td>
                    <td className="px-4 py-2.5">
                      {d.pushEnabled ? <span className="text-primary">Асаалттай</span> : <span className="text-yellow-400">Асаагаагүй</span>}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{fmt(d.lastSeenAt)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => revoke(d)} className={dangerButton}>
                        Хүчингүй болгох
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {data.history.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-bold text-foreground">Сүүлийн шийдвэрүүд</h2>
          <ul className="text-sm text-muted-foreground space-y-1">
            {data.history.map((d) => (
              <li key={d._id}>
                {fmt(d.decidedAt)} — {personnelLabel(d)} ({d.label}):{" "}
                {d.status === "rejected" ? "татгалзсан" : "хүчингүй болгосон"}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * Хүсэлтийг хүний нөөцийн аль бүртгэлтэй холбохыг урьдчилан сонгоно: энэ хэрэглэгчийн бүртгэл (утсаа сольж байгаа),
 * дараа нь ижил утасны дугаартай, эсвэл ижил нэртэй ганц бүртгэл. Хэд хэд таарвал хүний нөөц өөрөө сонгоно.
 */
function suggestPerson(device: DeviceRow, personnel: Person[]) {
  const linked = personnel.find((p) => p.userId === device.userId);
  if (linked) return { person: linked, why: "Бүртгэлтэй алба хаагч — шинэ утаснаас хүсэлт илгээсэн" };
  const free = personnel.filter((p) => !p.userId);
  // Үндсэн эсвэл бусад дугаарын аль нэг нь таарвал
  const samePhone = device.phone ? free.filter((p) => p.phone === device.phone || p.extraPhones?.includes(device.phone!)) : [];
  if (samePhone.length === 1) return { person: samePhone[0], why: "Утасны дугаар нь хүний нөөцийн бүртгэлтэй таарлаа" };
  // "Б.Болд" ≈ "Батын Болд"; дундын утастай хүмүүсээс нэрээр нь ялгана
  const named = (samePhone.length ? samePhone : free).filter((p) => sameName(p.name, device.name));
  if (named.length === 1) {
    return {
      person: named[0],
      why: samePhone.length
        ? "Утасны дугаар, нэр нь хүний нөөцийн бүртгэлтэй таарлаа"
        : "Нэр нь хүний нөөцийн бүртгэлтэй таарлаа — шалгаад зөвшөөрнө үү",
    };
  }
  return null;
}

function PendingRequest({
  device,
  personnel,
  groups,
  onDecide,
}: {
  device: DeviceRow;
  personnel: Person[];
  groups: string[];
  onDecide: (body: Record<string, unknown>) => void;
}) {
  const match = suggestPerson(device, personnel);
  const [personnelId, setPersonnelId] = useState(match?.person._id ?? "new");
  const choices = personnel.filter((p) => !p.userId || p.userId === device.userId);

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <p className="font-bold text-foreground">{personnelLabel(device)}</p>
        <p className="text-sm text-muted-foreground">
          {[device.position, formatPhone(device.phone), device.email].filter(Boolean).join(" · ")}
        </p>
        <p className="text-xs text-muted-foreground">
          {device.label} · {fmt(device.createdAt)}
        </p>
        <p className={`text-xs ${match ? "text-primary" : "text-muted-foreground"}`}>
          {match ? `✓ ${match.why}` : "Хүний нөөцийн бүртгэлээс олдсонгүй — шинээр бүртгэх эсвэл жагсаалтаас сонгоно уу"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={personnelId}
          onChange={(e) => setPersonnelId(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground max-w-72"
          aria-label="Алба хаагчтай холбох"
        >
          <option value="new">Шинэ алба хаагчаар бүртгэх</option>
          <PersonOptions
            people={choices}
            groups={groups}
            label={(p) =>
              `${personnelLabel(p)}${p.position ? ` — ${p.position}` : ""}${p.phone ? ` · ${formatPhone(p.phone)}` : ""}`
            }
          />
        </select>
        <button
          onClick={() => onDecide({ action: "approve", personnelId })}
          className="px-3 py-1.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground"
        >
          Зөвшөөрөх
        </button>
        <button onClick={() => onDecide({ action: "reject" })} className={smallButton}>
          Татгалзах
        </button>
      </div>
    </div>
  );
}
