import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Зэвсэг | Зэвсэгт хүчин | 013 анги | Зэвсэгт хүчний 013 дугаар анги",
  description:
    "Зэвсэгт хүчний 013 дугаар ангийн албан ёсны вэб сайт. Монгол улсын зэвсэгт хүчин, зэвсэг, 013 анги, цэргийн анги, тоног төхөөрөмж, сургалт.",
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
