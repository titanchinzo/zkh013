"use client";

import { useEffect, useState } from "react";
import { BYPASS_CONTACT_NAME, bypassContactCard, type BypassState } from "@/lib/bypass";
import { formatDateTime, formatPhone } from "@/lib/hr";

// iPhone: яаралтай үед залгах дугаарыг хадгалаад Emergency Bypass асаах заавар (lib/bypass.ts). Тохируулсныг утас апп-д
// хэлдэггүй тул хэрэглэгч өөрөө тэмдэглэж, хүний нөөц «Бэлэн байдал»-аас залгаж шалгана.

export type BypassInfo = { numbers: string[]; state: BypassState; at: string | null };

const primary = "w-full h-11 rounded-md bg-primary text-primary-foreground font-semibold disabled:opacity-50";

/** Аппын нүүр — зөвхөн iPhone дээр, хүний нөөц дугаараа оруулсан үед */
export function IphoneBypassSection({ bypass, onChange }: { bypass: BypassInfo | null; onChange: () => void }) {
  const [iphone, setIphone] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser check after mount
    setIphone(/iPhone/.test(navigator.userAgent));
  }, []);

  if (!iphone || !bypass) return null;
  const ready = bypass.state === "set" || bypass.state === "tested";

  async function mark(done: boolean) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/app/bypass", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError((await res?.json().catch(() => null))?.error ?? "Хадгалж чадсангүй. Сүлжээгээ шалгана уу.");
      return;
    }
    setOpen(false);
    onChange();
  }

  if (ready && !open) {
    return (
      <section className="rounded-xl border border-border bg-card p-4 space-y-1" aria-label="Яаралтай дуудлага">
        <p className="text-sm font-semibold text-primary">✓ Утас дуугүй үед яаралтай дуудлага дуугарна</p>
        <p className="text-xs text-muted-foreground">
          {bypass.state === "tested"
            ? "Хүний нөөц залгаж шалгасан."
            : `Та ${bypass.at ? formatDateTime(bypass.at) : ""}-д тэмдэглэсэн. Хүний нөөц залгаж шалгана.`}
        </p>
        <button onClick={() => setOpen(true)} className="text-xs text-primary hover:underline">
          Заавар харах
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-yellow-500/50 bg-card p-4 space-y-3" aria-label="Яаралтай дуудлага">
      <p className="font-semibold text-foreground">Утас дуугүй үед ч яаралтай дуудлага сонсох</p>
      <p className="text-sm text-muted-foreground">
        iPhone дээр апп дуугүй горимыг давж чадахгүй. Яаралтай үед танай ангиас залгах дуудлагыг утас дуугүй ч дуугардаг
        болгоно.
      </p>
      {bypass.state === "changed" && (
        <p className="text-sm text-yellow-400">Шинэ дугаар нэмэгдсэн. Тэр харилцагчдаа нэмж хадгалаад дахин тэмдэглэнэ үү.</p>
      )}
      <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
        <li>
          Доорх дугаарыг утасныхаа жагсаалтад <b className="text-foreground">«{BYPASS_CONTACT_NAME}»</b> нэрээр нэг харилцагч болгож
          хадгална.
          <ul className="mt-2 space-y-1.5">
            {bypass.numbers.map((n) => (
              <NumberRow key={n} number={n} />
            ))}
          </ul>
          <ContactLink numbers={bypass.numbers} />
        </li>
        <li>
          <b className="text-foreground">Contacts</b>-оос «{BYPASS_CONTACT_NAME}»-г нээж, <b className="text-foreground">Edit</b> дарна.
        </li>
        <li>
          <b className="text-foreground">Ringtone</b> дарж, <b className="text-foreground">Emergency Bypass</b>-ыг асаагаад{" "}
          <b className="text-foreground">Done</b> дарна.
        </li>
        <li>Доорх товчийг дарна. Хүний нөөц залгаж шалгана.</li>
      </ol>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button onClick={() => mark(true)} disabled={busy} className={primary}>
        {busy ? "Хадгалж байна..." : "Тохируулсан"}
      </button>
      {ready && (
        <div className="flex justify-between gap-3 text-xs">
          <button onClick={() => setOpen(false)} className="text-muted-foreground hover:underline">
            Хаах
          </button>
          <button onClick={() => mark(false)} disabled={busy} className="text-red-400 hover:underline">
            Тохиргоогоо болиулсан
          </button>
        </div>
      )}
    </section>
  );
}

function NumberRow({ number }: { number: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(`+976${number}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      // Хуулж чадахгүй хөтөч — дугаар нь харагдаж байгаа тул гараар бичнэ
    }
  }
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <span className="font-mono text-base text-foreground">{formatPhone(number)}</span>
      <button onClick={copy} className="text-xs font-semibold text-primary">
        {copied ? "✓ Хууллаа" : "Хуулах"}
      </button>
    </li>
  );
}

/** Бүх дугаартай харилцагчийн файл (vCard). Нээгдэхгүй бол дээрх дугаарыг гараар хадгална */
function ContactLink({ numbers }: { numbers: string[] }) {
  const [href, setHref] = useState("");
  const key = numbers.join();
  useEffect(() => {
    const url = URL.createObjectURL(new Blob([bypassContactCard(key.split(","))], { type: "text/vcard;charset=utf-8" }));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- object URLs exist only in the browser
    setHref(url);
    return () => URL.revokeObjectURL(url);
  }, [key]);
  if (!href) return null;
  return (
    <a href={href} download="013-angi.vcf" className="mt-2 inline-block text-xs font-semibold text-primary hover:underline">
      Харилцагчийн файл нээх
    </a>
  );
}
