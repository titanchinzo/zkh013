"use client";

import { useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { AndroidDownload } from "@/components/app/android-app";
import { InstallSteps, useInstall, type InstallState } from "@/components/app/install";

const button =
  "w-full h-12 rounded-md bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2";

type Platform = "android" | "iphone";
const PLATFORMS: [Platform, string][] = [
  ["android", "Android"],
  ["iphone", "iPhone"],
];

/** «Апп татах»: Android (апп файл — APK, вэб апп нь нэмэлт) / iPhone (вэб апп). Утсандаа тохирох нь сонгогдсон байна */
export function DownloadSection() {
  const state = useInstall();
  const [picked, setPicked] = useState<Platform | null>(null);

  if (!state.ready) return <div className="h-12" />;
  // Facebook, Messenger доторх хөтчөөс юу ч суулгах боломжгүй — эхлээд жинхэнэ хөтчөөр нээлгэнэ
  if (state.inApp) return <InstallSteps state={state} />;

  const platform = picked ?? (state.ios ? "iphone" : "android");
  const computer = !state.ios && !state.android;
  return (
    <div className="space-y-4">
      {computer && (
        <div className="space-y-2">
          <InstallSteps state={state} />
          {state.install && (
            <button onClick={state.install} className="text-xs text-primary hover:underline">
              Энэ компьютер дээр вэб апп суулгах
            </button>
          )}
        </div>
      )}
      <div role="tablist" aria-label="Утасны төрөл" className="grid grid-cols-2 gap-1 rounded-lg border border-border p-1">
        {PLATFORMS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            id={`download-${key}`}
            aria-selected={platform === key}
            aria-controls="download-panel"
            onClick={() => setPicked(key)}
            className={`h-11 rounded-md font-semibold ${
              platform === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="download-panel" aria-labelledby={`download-${platform}`} className="space-y-4">
        {platform === "android" ? (
          <>
            <AndroidDownload />
            <details className="rounded-md border border-border p-3">
              <summary className="cursor-pointer text-sm text-muted-foreground">Оронд нь вэб апп суулгах</summary>
              <div className="mt-3 space-y-3">
                <p className="text-sm text-yellow-400">Вэб апп дээр утас дуугүй үед улаан дохио дуугарахгүй.</p>
                {state.android ? (
                  <WebAppInstall state={state} />
                ) : (
                  <InstallSteps state={{ ...state, ios: false, android: true }} />
                )}
              </div>
            </details>
          </>
        ) : (
          <>
            {state.ios ? (
              <WebAppInstall state={state} />
            ) : (
              <InstallSteps state={{ ...state, ios: true, android: false }} />
            )}
            <p className="text-xs text-muted-foreground">
              iPhone дээр утас дуугүй үед улаан дохио дуугарахгүй. Оронд нь аппын нүүрэн дэх зааврын дагуу яаралтай дуудлагыг
              дуугүй үед ч дуугардаг болгоно.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/** Вэб апп: суулгасан бол нээх, хөтөч дэмжвэл шууд суулгах, үгүй бол алхам алхмаар заавар */
function WebAppInstall({ state }: { state: InstallState }) {
  if (state.standalone || state.installed) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-primary">
          {state.installed ? "✓ Суулгалаа. Нүүр дэлгэц дээрх «013 анги» аппыг нээнэ үү." : "✓ Апп суулгасан байна."}
        </p>
        <Link href="/app" className={button}>
          Апп нээх
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {state.install && !state.inApp ? (
        <button onClick={state.install} className={button}>
          <Download className="w-5 h-5" />
          Апп татах
        </button>
      ) : (
        <InstallSteps state={state} />
      )}
      <p className="text-xs text-muted-foreground">
        Суулгахгүйгээр хөтөч дээрээ ашиглах бол{" "}
        <Link href="/app" className="text-primary hover:underline">
          энд дарна
        </Link>{" "}
        (мэдэгдэл iPhone дээр зөвхөн суулгасан аппад ирнэ).
      </p>
    </div>
  );
}
