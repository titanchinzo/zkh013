import type { Metadata, Viewport } from "next";
import { AlertApp } from "@/components/app/alert-app";

export const metadata: Metadata = {
  title: "Зарлан мэдээлэх",
  robots: { index: false, follow: false },
};

// cover — iPhone-ий доод зураас (home indicator)-ны хэмжээг env(safe-area-inset-bottom)-оор авч, доод цэс,
// чатын бичих хэсгийг түүнээс дээш байрлуулна
export const viewport: Viewport = { themeColor: "#0a0f0a", viewportFit: "cover" };

// Утсан дээр суулгасан аппын цорын ганц хуудас — сайтын цэс, бусад хэсэг энд харагдахгүй
export default function AlertAppPage() {
  return (
    <main className="min-h-screen bg-background">
      <AlertApp />
    </main>
  );
}
