"use client";

import { useEffect, useRef, useState } from "react";
import { FingerprintPattern, LockKeyhole } from "lucide-react";
import { platformAuthenticatorIsAvailable, startAuthentication, startRegistration } from "@simplewebauthn/browser";

// Апп түгжээ (давхар түгжээ): зөвшөөрөгдсөн утас ч гэсэн аппаа нээх бүрд утасны өөрийн түгжээгээр (хурууны хээ,
// царай, PIN, хээ зурах) баталгаажуулна. Хээ, царай нь утаснаасаа гардаггүй — сервер зөвхөн утасны гарын үсгийг
// (WebAuthn) шалгана (app/api/app/lock).

/** Апп түгжигдсэнийг бусад хэсэг (чат г.м 403 авсан үед) мэдэгдэх event */
export const LOCK_EVENT = "zkh:app-locked";

// Баталгаажуулах цонх нээлттэй үед (Android-д) апп түр далд ордог — тэр үед түгжихгүй
let ceremony = false;
export const inLockCeremony = () => ceremony;

const IOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);

function describe(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "AbortError") return "Цуцлагдлаа эсвэл хугацаа дууслаа. Дахин оролдоно уу.";
  if (name === "NotSupportedError" || name === "SecurityError") {
    return "Энэ утас эсвэл хөтөч дэмжихгүй байна. Chrome (Android) эсвэл Safari (iPhone)-г шинэчлээд дахин оролдоно уу.";
  }
  return err instanceof Error && err.message ? err.message : "Алдаа гарлаа. Дахин оролдоно уу.";
}

export function LockScreen({ mode, name, onUnlocked }: { mode: "setup" | "locked"; name: string; onUnlocked: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Утсандаа дэлгэцийн түгжээ (PIN, хээ) тохируулаагүй бол эхлээд тохируулна
  const [noScreenLock, setNoScreenLock] = useState(false);
  const autoTried = useRef(false);
  const busyRef = useRef(false);

  async function run() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    ceremony = true;
    try {
      const res = await fetch("/api/app/lock", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Алдаа гарлаа");
      if (data.mode !== "off") {
        const response =
          data.mode === "setup"
            ? await startRegistration({ optionsJSON: data.options })
            : await startAuthentication({ optionsJSON: data.options });
        const verify = await fetch("/api/app/lock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ response }),
        });
        if (!verify.ok) throw new Error((await verify.json().catch(() => null))?.error ?? "Баталгаажуулж чадсангүй");
      }
      onUnlocked();
    } catch (err) {
      setError(describe(err));
    } finally {
      ceremony = false;
      busyRef.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    platformAuthenticatorIsAvailable()
      .then((ok) => !ok && setNoScreenLock(true))
      .catch(() => {});
  }, []);

  // Түгжээтэй апп харагдах бүрд (нээх, буцаж орох) нэг удаа шууд асууна. Далд байхад асуухгүй — хөтөч зөвшөөрдөггүй.
  // iPhone товч дарахыг шаарддаг тул тэнд товчоор.
  useEffect(() => {
    if (mode !== "locked" || IOS()) return;
    const onChange = () => {
      if (document.visibilityState !== "visible") {
        // Баталгаажуулах цонх (Android) аппыг түр далд оруулдаг — тэр нь «буцаж орох» биш
        if (!inLockCeremony()) autoTried.current = false;
        return;
      }
      if (autoTried.current) return;
      autoTried.current = true;
      run();
    };
    onChange();
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run reads refs; re-subscribe only when the mode changes
  }, [mode]);

  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center" aria-label="Апп түгжээ">
      <div className="flex size-20 items-center justify-center rounded-full border border-primary/40 bg-primary/10">
        <LockKeyhole className="size-9 text-primary" aria-hidden />
      </div>
      <div className="space-y-2">
        <p className="text-lg font-bold text-foreground">{mode === "setup" ? "Аппын түгжээ тохируулах" : "Апп түгжээтэй"}</p>
        <p className="text-sm text-muted-foreground">
          {mode === "setup"
            ? "Аппыг утасныхаа түгжээгээр (хурууны хээ, царай эсвэл PIN) хамгаална. Цаашид апп нээх бүрд баталгаажуулна."
            : `${name} — утасныхаа түгжээгээр (хурууны хээ, царай эсвэл PIN) нээнэ үү.`}
        </p>
      </div>
      <button
        onClick={run}
        disabled={busy}
        className="flex h-14 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50"
      >
        <FingerprintPattern className="size-6" aria-hidden />
        {busy ? "Хүлээж байна..." : mode === "setup" ? "Түгжээ тохируулах" : "Түгжээ тайлах"}
      </button>
      {error && <p className="max-w-xs text-sm text-red-400">{error}</p>}
      {noScreenLock && (
        <p className="max-w-xs rounded-lg border border-yellow-400/40 bg-yellow-400/10 px-3 py-2 text-xs text-yellow-300">
          Утсандаа дэлгэцийн түгжээ (PIN, хурууны хээ эсвэл царай) тохируулаагүй байж магадгүй. Утасныхаа «Тохиргоо» →
          «Аюулгүй байдал»-аас тохируулаад дахин оролдоно уу.
        </p>
      )}
      {mode === "setup" && (
        <p className="max-w-xs text-xs text-muted-foreground">
          Хурууны хээ, царай нь зөвхөн таны утсанд үлдэнэ — сервер рүү илгээгдэхгүй.
        </p>
      )}
    </section>
  );
}
