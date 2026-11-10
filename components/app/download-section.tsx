"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { InstallSteps, useInstall } from "@/components/app/install";

const button =
  "w-full h-12 rounded-md bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2";

/** «Апп татах» товч: суулгасан бол нээх, хөтөч дэмжвэл шууд суулгах, үгүй бол алхам алхмаар заавар */
export function DownloadSection() {
  const state = useInstall();

  if (!state.ready) return <div className="h-12" />;

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
