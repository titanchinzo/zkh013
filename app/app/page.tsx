import type { Metadata, Viewport } from "next";
import { AlertApp } from "@/components/app/alert-app";
import { InstallCapture } from "@/components/app/install-capture";

export const metadata: Metadata = {
  title: "Зарлан мэдээлэх",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0a0f0a" };

// Утсан дээр суулгасан аппын цорын ганц хуудас — сайтын цэс, бусад хэсэг энд харагдахгүй
export default function AlertAppPage() {
  return (
    <main className="min-h-screen bg-background">
      <InstallCapture />
      <AlertApp />
    </main>
  );
}
