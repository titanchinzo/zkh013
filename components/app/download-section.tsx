"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { AndroidDownload } from "@/components/app/android-app";
import { ANDROID_APP } from "@/lib/android-app";
import { InstallSteps, useInstall, type InstallState } from "@/components/app/install";

const button =
  "w-full h-12 rounded-md bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2";

/** «Апп татах»: Android-д апп (APK), вэб апп нь нэмэлт; бусад утсанд вэб апп */
export function DownloadSection() {
  const state = useInstall();
  // /download#android — нээлтээс өмнө туршигчид
  const [tester, setTester] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the address after mount
    setTester(window.location.hash === "#android");
  }, []);

  if (!state.ready) return <div className="h-12" />;
  if (!state.android || state.inApp || !(ANDROID_APP.released || tester)) return <WebAppInstall state={state} />;
  return (
    <div className="space-y-4">
      <AndroidDownload />
      <details className="rounded-md border border-border p-3">
        <summary className="cursor-pointer text-sm text-muted-foreground">Оронд нь вэб апп суулгах</summary>
        <div className="mt-3 space-y-3">
          <p className="text-sm text-yellow-400">Вэб апп дээр утас дуугүй үед улаан дохио дуугарахгүй.</p>
          <WebAppInstall state={state} />
        </div>
      </details>
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
