import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { SITE_NAME, SITE_OG_IMAGE, SITE_URL } from "@/lib/site";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider>
      <html
        lang="mn"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    </ClerkProvider>
  );
}
