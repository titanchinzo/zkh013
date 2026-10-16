import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Mongolian } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { SITE_NAME, SITE_OG_IMAGE, SITE_URL } from "@/lib/site";
import { getScript } from "@/lib/mgl/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Монгол бичгийн (MGL) горимын фонт — зөвхөн тэр горимд ашиглагдах үед татагдана
const mongolian = Noto_Sans_Mongolian({
  variable: "--font-mongolian",
  weight: "400",
  subsets: ["mongolian"],
  preload: false,
});

const description =
  "Зэвсэгт хүчний 013 дугаар ангийн албан ёсны вэб сайт. Монгол улсын зэвсэгт хүчин, зэвсэг, 013 анги, цэргийн анги, тоног төхөөрөмж, сургалт.";

// Таб дээрх лого (favicon.ico, icon.png, apple-icon.png) app/ хавтаснаас автоматаар орно
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Зэвсэг | Зэвсэгт хүчин | 013 анги | Зэвсэгт хүчний 013 дугаар анги",
    template: `%s | ${SITE_NAME}`,
  },
  description,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "mn_MN",
    title: SITE_NAME,
    description,
    images: [SITE_OG_IMAGE],
  },
  twitter: { card: "summary_large_image", images: [SITE_OG_IMAGE.url] },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // MN — кирилл, MGL — монгол бичиг (босоо). Цэсний MN/MGL товчоор солигдоно.
  const script = await getScript();

  return (
    <ClerkProvider>
      <html
        lang={script === "mgl" ? "mn-Mong" : "mn"}
        data-script={script}
        className={`${geistSans.variable} ${geistMono.variable} ${mongolian.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    </ClerkProvider>
  );
}
