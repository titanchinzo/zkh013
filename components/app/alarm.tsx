"use client";

import { useEffect, useState } from "react";
import { Siren } from "lucide-react";
import { formatDateTime } from "@/lib/hr";

// Улаан түвшний зарлан мэдээллийн дохио. Аппын дотор медиа дуугаар (хонх, мэдэгдлийн дуунаас тусдаа) давтагдан
// дуугарч, чичирнэ. Апп хаалттай үед вэб апп дуу гаргаж чадахгүй — тэр үед мэдэгдэл (public/sw.js) л очно.

const RATE = 16_000;
// 5 секундээс урт дууг л утас «медиа» гэж үзнэ (Chrome Android)
const SECONDS = 6;
const SWEEP_SECONDS = 1.2;
const VIBRATION = [800, 200, 800];
const VIBRATE_EVERY_MS = 2_000;
// Утсаа орхисон ч тасралтгүй дуугарсаар байхгүй — дараагийн давтан мэдэгдэл дахин эхлүүлнэ
const SIREN_MAX_MS = 5 * 60_000;

/** Дуут дохио: 700 → 1600 Гц рүү өсөж давтагдах хурц дуу (WAV, 16 бит) */
function sirenWave(): Blob {
  const samples = RATE * SECONDS;
  const view = new DataView(new ArrayBuffer(44 + samples * 2));
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples * 2, true);
  let phase = 0;
  for (let i = 0; i < samples; i++) {
    const rise = ((i / RATE) % SWEEP_SECONDS) / SWEEP_SECONDS;
    phase += (2 * Math.PI * (700 + 900 * rise)) / RATE;
    view.setInt16(44 + i * 2, Math.tanh(4 * Math.sin(phase)) * 0.9 * 0x7fff, true);
  }
  return new Blob([view.buffer], { type: "audio/wav" });
}

// Нэг л тоглуулагч: хэрэглэгч нэг удаа дарж дуу зөвшөөрсөн бол дараагийн дохио дахин зөвшөөрөл асуухгүй (iPhone)
let player: HTMLAudioElement | null = null;
// Одоо дуугаргаж буй хэсэг — өмнөх хэсэг хаагдахдаа шинэ дохиог зогсоохгүй
let owner: symbol | null = null;

/** iPhone (Safari): дууг «тоглуулах» төрөлтэй болгоно — энгийн төрөл нь дуугүй товчлуурт захирагддаг */
function setAudioSession(type: "playback" | "auto") {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = type;
}

/** Дуугарч эхэлсэн бол true; хөтөч дэлгэц дарахыг шаардвал false */
async function startSiren(by: symbol) {
  owner = by;
  if (!player) {
    player = new Audio(URL.createObjectURL(sirenWave()));
    player.loop = true;
  }
  player.volume = 1;
  setAudioSession("playback");
  try {
    await player.play();
    return true;
  } catch {
    return false;
  }
}

function stopSiren(by: symbol) {
  if (owner !== by) return;
  owner = null;
  if (player) {
    player.pause();
    player.currentTime = 0;
  }
  setAudioSession("auto");
  navigator.vibrate?.(0);
}

/** on байх хугацаанд дуугарч, чичирнэ. true буцаавал хөтөч дууг хараахан зөвшөөрөөгүй — дэлгэц дарахад эхэлнэ */
function useSiren(on: boolean) {
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    if (!on) return;
    const me = Symbol("siren");
    let stopped = false;
    const play = async () => {
      if (stopped) return;
      const ok = await startSiren(me);
      if (!stopped) setBlocked(!ok);
    };
    const vibrate = () => navigator.vibrate?.(VIBRATION);
    const onVisible = () => document.visibilityState === "visible" && play();
    const events = ["touchend", "click"] as const;
    function stop() {
      if (stopped) return;
      stopped = true;
      window.clearInterval(vibrating);
      window.clearTimeout(limit);
      events.forEach((name) => document.removeEventListener(name, play));
      document.removeEventListener("visibilitychange", onVisible);
      stopSiren(me);
    }
    const vibrating = window.setInterval(vibrate, VIBRATE_EVERY_MS);
    const limit = window.setTimeout(stop, SIREN_MAX_MS);
    events.forEach((name) => document.addEventListener(name, play));
    document.addEventListener("visibilitychange", onVisible);
    play();
    vibrate();
    return stop;
  }, [on]);
  return blocked;
}

function TapForSound() {
  return <p className="text-sm font-semibold">Дохио дуугаргахын тулд дэлгэцэн дээр дарна уу</p>;
}

/** Апп түгжээтэй үед: гарчиг, дохио. Дэлгэрэнгүй, «Хүлээн авлаа» нь түгжээг тайлсны дараа */
export function AlarmBanner({ title }: { title: string }) {
  const [muted, setMuted] = useState(false);
  const blocked = useSiren(!muted);
  return (
    <section role="alert" aria-label="Улаан дохио" className="space-y-3 rounded-xl bg-red-700 p-4 text-center text-white">
      <p className="flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wide">
        <Siren className="size-5 animate-pulse" aria-hidden /> Улаан түвшин
      </p>
      <p className="text-lg font-bold">{title}</p>
      <p className="text-sm">Түгжээг тайлж, «Хүлээн авлаа» дарна уу.</p>
      {blocked && !muted && <TapForSound />}
      {!muted && (
        <button onClick={() => setMuted(true)} className="h-10 w-full rounded-md border border-white/60 text-sm font-semibold">
          Дуу зогсоох
        </button>
      )}
    </section>
  );
}

type AlarmAlert = { id: string; title: string; body: string; startsAt: string };

/** Бүтэн дэлгэцийн улаан дохио — «Хүлээн авлаа» дарах хүртэл дуугарна */
export function AlarmScreen({ alert, onAck }: { alert: AlarmAlert; onAck: (id: string) => Promise<boolean> }) {
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const blocked = useSiren(!muted);

  async function ack() {
    setBusy(true);
    setError("");
    const ok = await onAck(alert.id);
    setBusy(false);
    if (!ok) setError("Илгээж чадсангүй. Сүлжээгээ шалгаад дахин дарна уу.");
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Улаан түвшний зарлан мэдээлэл"
      className="fixed inset-0 z-[70] flex flex-col bg-red-700 px-6 text-white"
      style={{
        // Эцэг хэсгийн space-y зайг авбал доод захад аппын цэс цухуйна
        margin: 0,
        paddingTop: "calc(env(safe-area-inset-top) + 2rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)",
      }}
    >
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col items-center gap-4 overflow-y-auto text-center">
        <Siren className="size-20 shrink-0 animate-pulse" aria-hidden />
        <p className="text-sm font-bold uppercase tracking-widest">Улаан түвшин</p>
        <p className="text-2xl font-bold break-words">{alert.title}</p>
        <p className="text-sm text-white/80">{formatDateTime(alert.startsAt)}</p>
        {alert.body && <p className="whitespace-pre-line break-words text-left text-base">{alert.body}</p>}
      </div>
      <div className="mx-auto w-full max-w-md space-y-3 pt-4 text-center">
        {blocked && !muted && <TapForSound />}
        {error && <p className="text-sm font-semibold">{error}</p>}
        <button
          onClick={ack}
          disabled={busy}
          className="h-14 w-full rounded-xl bg-white text-lg font-bold text-red-700 disabled:opacity-60"
        >
          {busy ? "Илгээж байна..." : "Хүлээн авлаа"}
        </button>
        {!muted && (
          <button onClick={() => setMuted(true)} className="h-11 w-full rounded-xl border border-white/60 font-semibold">
            Дуу зогсоох
          </button>
        )}
      </div>
    </div>
  );
}

const TEST_MS = 4_000;

/** Утасны медиа дуу нээлттэй эсэхийг шалгахад дохиог хэдэн секунд дуугаргана */
export function AlarmTest() {
  const [on, setOn] = useState(false);
  const blocked = useSiren(on);
  useEffect(() => {
    if (!on) return;
    const id = window.setTimeout(() => setOn(false), TEST_MS);
    return () => window.clearTimeout(id);
  }, [on]);
  return (
    <div className="space-y-1">
      <button onClick={() => setOn(!on)} className="text-sm font-semibold text-primary hover:underline">
        {on ? "Зогсоох" : "Улаан дохионы дууг турших"}
      </button>
      <p className="text-xs text-muted-foreground">
        {on && blocked
          ? "Хөтөч дууг зөвшөөрсөнгүй. Дахин дарж үзнэ үү."
          : "Сонсогдохгүй бол утасныхаа медиа дууг чангална уу."}
      </p>
    </div>
  );
}
