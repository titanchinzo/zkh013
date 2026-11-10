import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import { BellRing, CalendarCheck, Smartphone } from "lucide-react";
import { DownloadSection } from "@/components/app/download-section";
import { InstallCapture } from "@/components/app/install-capture";

export const metadata: Metadata = {
  title: "Апп татах",
  description: "Зэвсэгт хүчний 013 дугаар ангийн алба хаагчдын «Зарлан мэдээлэх» апп — утсандаа суулгах заавар.",
  alternates: { canonical: "/download" },
};

export const viewport: Viewport = { themeColor: "#0a0f0a" };

const FEATURES = [
  { icon: BellRing, text: "Зарлан мэдээлэл утсанд тань мэдэгдлээр шууд ирнэ" },
  { icon: CalendarCheck, text: "Өөрийн харуул, манааны хуваарийг харна" },
  { icon: Smartphone, text: "Үнэгүй — App Store, Play Store хэрэггүй, сайтаас шууд суулгана" },
];

const AFTER_INSTALL = [
  "Суулгасан аппаа нээж, и-мэйлээрээ нэвтэрнэ (анх удаа бол «Шинээр бүртгүүлэх»).",
  "Цолоо сонгож, овог нэр, албан тушаалаа бичээд «Хүсэлт илгээх» дарна.",
  "Хүний нөөц таны утсыг зөвшөөрнө.",
  "Апп дээрх «Мэдэгдэл асаах» товчийг дарна.",
];

// Алба хаагчдад зориулсан аппыг татах хуудас — сайтын цэсний «Апп татах»-аас орно
export default function DownloadPage() {
  return (
    <main className="min-h-screen bg-background">
      <InstallCapture />
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
          ← Нүүр хуудас
        </Link>

        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-start">
          <section className="space-y-6">
            <div className="flex items-center gap-4">
              <Image
                src="/app-icon-192.png"
                alt=""
                width={72}
                height={72}
                className="rounded-2xl border border-border"
                priority
              />
              <div>
                <h1 className="text-2xl font-bold text-foreground">Апп татах</h1>
                <p className="text-sm text-muted-foreground">013 анги — Зарлан мэдээлэх</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Зэвсэгт хүчний 013 дугаар ангийн алба хаагчдад зориулсан апп. Хүний нөөцийн зөвшөөрөлтэй хүн ашиглана.
            </p>

            <ul className="space-y-3">
              {FEATURES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3 text-sm text-foreground">
                  <Icon className="w-5 h-5 text-primary shrink-0" />
                  {text}
                </li>
              ))}
            </ul>

            <div className="rounded-xl border border-border bg-card p-4">
              <DownloadSection />
            </div>
          </section>

          <aside className="hidden md:block rounded-xl border border-border bg-card p-4 text-center space-y-3 w-56">
            <Image src="/app-qr.png" alt="unit013.mn/download хаягийн QR код" width={192} height={192} className="mx-auto rounded-md" />
            <p className="text-xs text-muted-foreground">Компьютерээс нээсэн бол утасныхаа камераар уншуулна</p>
            <p className="text-xs text-foreground font-mono">unit013.mn/download</p>
          </aside>
        </div>

        <section className="space-y-3">
          <h2 className="font-bold text-foreground">Суулгасны дараа</h2>
          <ol className="list-decimal pl-5 space-y-1.5 text-sm text-muted-foreground">
            {AFTER_INSTALL.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="text-sm text-muted-foreground">
            Нэг хүн нэг л утсаар ашиглана. Утсаа солих, гээх үед хүний нөөцөд хандана.
          </p>
        </section>
      </div>
    </main>
  );
}
