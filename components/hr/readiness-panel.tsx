"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { ANDROID_APP } from "@/lib/android-app";
import { BYPASS_LABEL, formatNumbers, telHref, type BypassState } from "@/lib/bypass";
import { CONTACT } from "@/lib/contact";
import { formatDateTime, formatPhone } from "@/lib/hr";
import { usePolling } from "@/lib/use-polling";

// Дохионы бэлэн байдал: хэний утас дуугүй үед ч улаан дохио (Android апп) эсвэл яаралтай дуудлага (iPhone-ы Emergency
// Bypass) сонсогдох. Хүний нөөцийн вэб хуудас (/admin/readiness) болон утсан дээрх апп хоёулаа ашиглана.

type PhoneRow = {
  id: string;
  name: string;
  phone: string;
  // Улаан дохио илгээх эсэх; null — алба хаагчийн бүртгэлтэй холбогдоогүй
  alarm: boolean | null;
  kind: "iphone" | "android" | "other";
  push: boolean;
  apk: number | null;
  bypass: BypassState;
  bypassAt: string | null;
  testedAt: string | null;
  lastSeenAt: string | null;
};
type Data = { numbers: string[]; phones: PhoneRow[] };

const JSON_HEADERS = { "Content-Type": "application/json" };
const small = "rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground disabled:opacity-50";

const BYPASS_COLOR: Record<BypassState, string> = {
  none: "text-yellow-400",
  changed: "text-yellow-400",
  set: "text-sky-400",
  tested: "text-primary",
};
// Анхаарах нь эхэнд
const BYPASS_ORDER: Record<BypassState, number> = { none: 0, changed: 1, set: 2, tested: 3 };

export function ReadinessPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/hr/readiness", { cache: "no-store" }).catch(() => null);
    // Сүлжээ тасарсан үед өмнөх жагсаалтаа хэвээр үлдээнэ
    if (res?.ok) setData(await res.json());
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);
  usePolling(load, 15_000);

  async function patch(p: PhoneRow, body: { result: "rang" | "silent" } | { alarm: boolean }) {
    setBusy(p.id);
    setError("");
    const res = await fetch(`/api/hr/readiness/${p.id}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!res?.ok) setError((await res?.json().catch(() => null))?.error ?? "Алдаа гарлаа");
    await load();
    setBusy("");
  }

  function result(p: PhoneRow, value: "rang" | "silent") {
    if (value === "silent" && !confirm(`${p.name}: дуугараагүй гэж тэмдэглэх үү? Тэр хүний аппад заавар дахин гарна.`)) return;
    patch(p, { result: value });
  }

  if (!data) return <p className="text-sm text-muted-foreground">Ачааллаж байна...</p>;

  const iphones = data.phones
    .filter((p) => p.kind === "iphone")
    .sort((a, b) => BYPASS_ORDER[a.bypass] - BYPASS_ORDER[b.bypass]);
  const androids = data.phones
    .filter((p) => p.kind === "android")
    .sort((a, b) => Number(Boolean(a.apk)) - Number(Boolean(b.apk)));
  const others = data.phones.filter((p) => p.kind === "other");
  const set = iphones.filter((p) => p.bypass === "set").length;
  const tested = iphones.filter((p) => p.bypass === "tested").length;
  const alarmOff = data.phones.filter((p) => p.alarm === false);
  const setAlarm = (p: PhoneRow, alarm: boolean) => patch(p, { alarm });

  return (
    <div className="space-y-6">
      <NumbersForm key={data.numbers.join()} numbers={data.numbers} onSaved={load} />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <p className="text-sm text-muted-foreground">
        «Дохио»-г авбал тэр хүнд улаан (цугларалтын) дохио илгээхгүй, мэдээлэл аппад нь харагдана.{" "}
        <span className="text-foreground">
          {alarmOff.length
            ? `Дохио илгээхгүй ${alarmOff.length} хүн: ${alarmOff.map((p) => p.name).join(", ")}.`
            : "Одоо бүх хүнд илгээнэ."}
        </span>
      </p>

      <section className="space-y-3" aria-label="iPhone">
        <h2 className="font-bold text-foreground">iPhone ({iphones.length})</h2>
        <p className="text-sm text-muted-foreground">
          Залгаж шалгасан: {tested} · Өөрөө тэмдэглэсэн: {set} · Тохируулаагүй: {iphones.length - set - tested}
        </p>
        <p className="text-xs text-muted-foreground">
          Утас энэ тохиргоог апп-д хэлдэггүй. Тэр хүнээр утсаа дуугүй болгуулаад дээрх дугаараас залгаж, дуугарсан эсэхийг
          тэмдэглэнэ.
        </p>
        <ul className="space-y-2">
          {iphones.map((p) => (
            <li key={p.id} className="space-y-2 rounded-xl border border-border p-3" aria-label={p.name}>
              <PhoneHead p={p} busy={busy === p.id} onAlarm={setAlarm} />
              <p className={`text-sm font-semibold ${BYPASS_COLOR[p.bypass]}`}>
                {BYPASS_LABEL[p.bypass]}
                {p.bypass === "tested" && p.testedAt && <Muted text={formatDateTime(p.testedAt)} />}
                {p.bypass === "set" && p.bypassAt && <Muted text={formatDateTime(p.bypassAt)} />}
              </p>
              {data.numbers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {p.phone && (
                    <a href={telHref(p.phone)} className={small}>
                      Залгах
                    </a>
                  )}
                  <button onClick={() => result(p, "rang")} disabled={busy === p.id} className={small}>
                    Дуугарсан
                  </button>
                  {p.bypass !== "none" && (
                    <button onClick={() => result(p, "silent")} disabled={busy === p.id} className={small}>
                      Дуугараагүй
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3" aria-label="Android">
        <h2 className="font-bold text-foreground">Android ({androids.length})</h2>
        <p className="text-sm text-muted-foreground">
          Android апптай: {androids.filter((p) => p.apk).length} · Апп суулгаагүй: {androids.filter((p) => !p.apk).length}
        </p>
        <ul className="space-y-2">
          {androids.map((p) => (
            <li key={p.id} className="space-y-1 rounded-xl border border-border p-3" aria-label={p.name}>
              <PhoneHead p={p} busy={busy === p.id} onAlarm={setAlarm} />
              <p className={`text-sm font-semibold ${p.apk ? "text-primary" : "text-yellow-400"}`}>
                {p.apk ? (p.apk < ANDROID_APP.version ? "Android апп (хуучин хувилбар)" : "Android апп") : "Android апп суулгаагүй"}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {others.length > 0 && (
        <section className="space-y-3" aria-label="Бусад">
          <h2 className="font-bold text-foreground">Бусад ({others.length})</h2>
          <ul className="space-y-2">
            {others.map((p) => (
              <li key={p.id} className="rounded-xl border border-border p-3" aria-label={p.name}>
                <PhoneHead p={p} busy={busy === p.id} onAlarm={setAlarm} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Muted({ text }: { text: string }) {
  return <span className="ml-2 text-xs font-normal text-muted-foreground">{text}</span>;
}

function PhoneHead({ p, busy, onAlarm }: { p: PhoneRow; busy: boolean; onAlarm: (p: PhoneRow, alarm: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{p.name}</p>
        <p className="text-xs text-muted-foreground">
          {p.phone ? formatPhone(p.phone) : "дугааргүй"}
          {!p.push && <span className="ml-2 text-yellow-400">мэдэгдэл унтраалттай</span>}
        </p>
      </div>
      <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground" title="Улаан дохио илгээх эсэх">
        <input
          type="checkbox"
          checked={p.alarm !== false}
          disabled={busy || p.alarm === null}
          onChange={(e) => onAlarm(p, e.target.checked)}
          aria-label={`${p.name}: улаан дохио`}
          className="size-5 accent-[var(--primary)] disabled:opacity-40"
        />
        Дохио
      </label>
    </div>
  );
}

/** Яаралтай үед залгах дугаарууд — iPhone хэрэглэгчид эдгээрийг хадгалж, Emergency Bypass асаана */
function NumbersForm({ numbers, onSaved }: { numbers: string[]; onSaved: () => Promise<void> }) {
  const [value, setValue] = useState(formatNumbers(numbers));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const next = value.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
    if (numbers.length > 0 && next.length === 0 && !confirm("Дугаарыг бүгдийг нь арилгах уу? iPhone-ы заавар хэнд ч харагдахаа болино.")) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/hr/readiness", {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify({ numbers: next }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError((await res?.json().catch(() => null))?.error ?? "Алдаа гарлаа");
      return;
    }
    await onSaved();
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-xl border border-border bg-card p-4">
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-foreground">Яаралтай үед залгах дугаар</span>
        <span className="block text-xs text-muted-foreground">
          Тусгай дугаар хэрэггүй: жижүүр, хүний нөөцийн залгадаг ердийн дугаар (залгахад нөгөө утсан дээр харагддаг нь).
          iPhone-той хүмүүс үүнийг хадгалж, дуугүй үед ч дуугардаг болгоно. Зөвхөн эдгээр дугаараас залгахад дуугарна. Олон
          бол таслалаар. Шинэ дугаар нэмбэл тэд дахин тохируулна.
        </span>
        <Input
          name="numbers"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="tel"
          placeholder={`Жишээ нь: ${CONTACT.phone}`}
          maxLength={120}
        />
      </label>
      {numbers.length === 0 && (
        <p className="text-sm text-yellow-400">Дугаар оруулаагүй тул iPhone-той хүмүүст заавар харагдахгүй байна.</p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy || value === formatNumbers(numbers)}
        className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Хадгалж байна..." : "Хадгалах"}
      </button>
    </form>
  );
}
