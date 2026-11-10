"use client";

import { useEffect, useState } from "react";

// Апп суулгах: Android/компьютерийн Chrome, Edge — өөрийн суулгах цонхтой (beforeinstallprompt);
// iPhone-д ийм цонх байхгүй тул Safari-гийн «Нүүр дэлгэцэнд нэмэх»-ийг алхам алхмаар заана.

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type InstallWindow = Window & { __installEvent?: InstallEvent | null };

export type InstallState = {
  ready: boolean;
  /** Суулгасан аппаас нээсэн */
  standalone: boolean;
  ios: boolean;
  android: boolean;
  /** Facebook, Messenger, Instagram доторх хөтөч — эндээс суулгах боломжгүй */
  inApp: boolean;
  /** Сая суулгасан */
  installed: boolean;
  /** Хөтчийн өөрийн суулгах цонх (байхгүй бол null) */
  install: (() => Promise<void>) | null;
};

export function useInstall(): InstallState {
  const [env, setEnv] = useState({ ready: false, standalone: false, ios: false, android: false, inApp: false });
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability check after mount
    setEnv({
      ready: true,
      standalone:
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
      // iPad нь өөрийгөө Mac гэж танилцуулдаг
      ios: /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1),
      android: /Android/.test(ua),
      inApp: /FBAN|FBAV|FB_IAB|Messenger|Instagram/.test(ua),
    });
    const early = (window as InstallWindow).__installEvent;
    if (early) setEvent(early);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => {
      setEvent(null);
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = event
    ? async () => {
        await event.prompt();
        if ((await event.userChoice).outcome === "accepted") {
          setEvent(null);
          (window as InstallWindow).__installEvent = null;
        }
      }
    : null;
  return { ...env, installed, install };
}

/** Хөтчийн суулгах цонх байхгүй үед гараар суулгах алхмууд */
export function InstallSteps({ state }: { state: InstallState }) {
  if (state.inApp) {
    return (
      <p className="text-sm text-yellow-400">
        Facebook, Messenger доторх хөтчөөс апп суулгах боломжгүй. Баруун дээд буланд байгаа <b>⋯</b> эсвэл <b>⋮</b>{" "}
        цэснээс <b>Хөтөч дээр нээх</b> (Open in browser)-ийг сонгоод, тэндээсээ суулгана уу.
      </p>
    );
  }
  if (state.ios) {
    return (
      <ol className="list-decimal pl-5 space-y-1.5 text-sm text-muted-foreground">
        <li>Энэ хуудсыг <b className="text-foreground">Safari</b>-аар нээнэ.</li>
        <li>
          Доод хэсгийн <b className="text-foreground">Хуваалцах</b> (□↑) товчийг дарна.
        </li>
        <li>
          <b className="text-foreground">Нүүр дэлгэцэнд нэмэх</b> (Add to Home Screen)-ийг сонгоод <b className="text-foreground">Нэмэх</b>{" "}
          (Add) дарна.
        </li>
        <li>Нүүр дэлгэц дээр гарсан «013 анги» аппыг нээнэ.</li>
      </ol>
    );
  }
  if (state.android) {
    return (
      <ol className="list-decimal pl-5 space-y-1.5 text-sm text-muted-foreground">
        <li>Энэ хуудсыг <b className="text-foreground">Chrome</b>-оор нээнэ.</li>
        <li>
          Баруун дээд <b className="text-foreground">⋮</b> цэснээс <b className="text-foreground">Апп суулгах</b> (Install app) эсвэл{" "}
          <b className="text-foreground">Нүүр дэлгэцэнд нэмэх</b>-ийг сонгоно.
        </li>
        <li>Нүүр дэлгэц дээр гарсан «013 анги» аппыг нээнэ.</li>
      </ol>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      Апп нь утсанд зориулагдсан. Утсаараа <b className="text-foreground">unit013.mn/download</b> хаягийг нээх эсвэл QR кодыг
      уншуулна.
    </p>
  );
}
