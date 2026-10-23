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
  "Хошууч генерал Р.Гаваагийн нэрэмжит Зэвсэгт хүчний 013 дугаар ангийн албан ёсны вэб сайт — ангийн мэдээ, үйл ажиллагаа, сургалт, холбоо барих мэдээлэл.";

// Таб дээрх лого (favicon.ico, icon.png, apple-icon.png) app/ хавтаснаас автоматаар орно.
// Гарчиг ангийн нэрээр эхэлнэ — хүмүүс Google-д яг ингэж хайдаг
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | Албан ёсны вэб сайт`,
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
        // Chrome "mn-Mong"-г танихгүй (хэлийг "und" гэж үздэг) тул MGL хуудсыг орчуулахыг санал болгож,
        // монгол бичиг болон "MN" товчийг ("Миннесота") эвддэг — кирилл хувилбар нь MN горим
        translate={script === "mgl" ? "no" : undefined}
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          {/* MGL горимд: монгол бичгийн фонтыг (globals.css) урьдчилан татна, Chrome-ийн орчуулах саналыг хаана —
              React эдгээрийг <head> руу зөөнө */}
          {script === "mgl" && (
            <>
              <link rel="preload" href={MGL_FONT_URL} as="font" type="font/ttf" crossOrigin="anonymous" />
              <meta name="google" content="notranslate" />
            </>
          )}
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
