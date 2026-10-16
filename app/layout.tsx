import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { SITE_NAME, SITE_OG_IMAGE, SITE_URL } from "@/lib/site";
import { MGL_FONT_URL } from "@/lib/mgl/shared";
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
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          {/* Монгол бичгийн фонтыг (globals.css) зөвхөн MGL горимд урьдчилан татна — React <head> руу зөөнө */}
          {script === "mgl" && (
            <link rel="preload" href={MGL_FONT_URL} as="font" type="font/ttf" crossOrigin="anonymous" />
          )}
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
