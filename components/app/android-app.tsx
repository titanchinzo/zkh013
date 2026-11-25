"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ANDROID_APP } from "@/lib/android-app";

// Android апп (android/): сайтыг Chrome-оор нээж, улаан дохиог утас дуугүй үед ч сэрүүлгийн дуугаар дуугаргана.
// Вэб апп (PWA), iPhone-д энэ боломж байхгүй.

const KEY = "zkh013-apk";
const primary =
  "w-full h-11 rounded-md bg-primary text-primary-foreground font-semibold flex items-center justify-center disabled:opacity-50";
const secondary = "w-full h-11 rounded-md border border-border text-foreground font-semibold flex items-center justify-center";

/** Апп нээхдээ хаягт хувилбараа (?apk=1) дамжуулдаг: утсан дээр санаад, хаягаас хасна. Аппгүй утсанд null */
export function rememberAndroidApp(): number | null {
  const url = new URL(window.location.href);
  const opened = Number(url.searchParams.get("apk")) || null;
  if (url.searchParams.has("apk")) {
    url.searchParams.delete("apk");
    window.history.replaceState(null, "", url.pathname + url.search);
  }
  try {
    if (opened) localStorage.setItem(KEY, String(opened));
    return opened ?? (Number(localStorage.getItem(KEY)) || null);
  } catch {
    return opened;
  }
}

/** Аппын нүүр: Android утсанд апп суулгах, шинэчлэх санал; апптай бол туршилтын дохио, тохиргоо */
export function AndroidAppSection({ apk, pushEnabled }: { apk: number | null; pushEnabled: boolean }) {
  const [android, setAndroid] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser check after mount
    setAndroid(/Android/.test(navigator.userAgent));
  }, []);

  if (!android || (!apk && !ANDROID_APP.released)) return null;
  if (!apk || apk < ANDROID_APP.version) {
    return (
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="font-semibold text-foreground">
          {apk ? "Аппын шинэ хувилбар гарлаа" : "Утас дуугүй үед ч улаан дохио сонсох"}
        </p>
        <p className="text-sm text-muted-foreground">
          {apk
            ? "Татаж суулгахад бүртгэл тань хэвээр үлдэнэ."
            : "Android апп суулгавал утасныхаа дууг хаасан ч улаан мэдээлэл сэрүүлгийн дуугаар дуугарна."}
        </p>
        {apk ? (
          <a href={ANDROID_APP.url} download className={secondary}>
            Шинэ хувилбарыг татах
          </a>
        ) : (
          <Link href="/download" className={secondary}>
            Android апп суулгах
          </Link>
        )}
      </section>
    );
  }
  return pushEnabled ? <AlarmDrill /> : null;
}

/** Жинхэнэ замаар (сервер → Google → Chrome → апп) туршилтын улаан дохио авна */
function AlarmDrill() {
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function drill() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/app/android", { method: "POST" }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setBusy(false);
    if (res?.ok) setSeconds(body.seconds);
    else setError(body?.error ?? "Илгээж чадсангүй. Сүлжээгээ шалгана уу.");
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <p className="font-semibold text-foreground">Улаан дохио</p>
      <p className="text-sm text-muted-foreground">
        {seconds
          ? `${seconds} секундын дараа дохио ирнэ. Одоо утсаа дуугүй болгож, дэлгэцээ унтраана уу.`
          : "Утас дуугүй үед дуугарах эсэхийг туршиж үзээрэй."}
      </p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button onClick={drill} disabled={busy} className={primary}>
        {busy ? "Илгээж байна..." : "Туршилтын дохио авах"}
      </button>
      <a href={ANDROID_APP.setupUrl} className={secondary}>
        Дохионы тохиргоо
      </a>
    </section>
  );
}

/** Татах хуудас, Android утсанд: APK, суулгах алхмууд */
export function AndroidDownload() {
  const [apk, setApk] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the version this phone's app reported
    setApk(rememberAndroidApp());
  }, []);

  if (apk && apk >= ANDROID_APP.version) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-primary">✓ Энэ утсанд Android апп суусан байна.</p>
        <Link href="/app" className={primary}>
          Апп нээх
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground">
        Утасны дууг хаасан ч <b>улаан дохио сэрүүлгийн дуугаар</b> дуугарна.
      </p>
      <a href={ANDROID_APP.url} download className={primary}>
        Android апп татах
      </a>
      <ol className="list-decimal pl-5 space-y-1.5 text-sm text-muted-foreground">
        <li>
          Татсан <b className="text-foreground">zkh013-{ANDROID_APP.version}.apk</b> файлыг нээнэ.
        </li>
        <li>
          «Үл мэдэх эх сурвалж» гэж асуувал хөтчөө зөвшөөрөөд, <b className="text-foreground">Суулгах</b> (Install) дарна.
        </li>
        <li>
          Google Play Protect асуувал <b className="text-foreground">Апп шалгах</b> (Scan app)-ыг сонгоно.
        </li>
        <li>Апп нээж, дэлгэц дээрх бүх алхмыг ✓ болгоод «Апп нээх» дарна.</li>
      </ol>
      <p className="text-xs text-muted-foreground">
        Хуучин «013 анги» апп (вэб апп) суулгасан бол тохиргооны дэлгэц түүнийг устгахыг санал болгоно. Бүртгэл тань хэвээр
        үлдэнэ. Файлыг зөвхөн unit013.mn-ээс татаарай.
      </p>
    </div>
  );
}
