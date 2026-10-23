import type { NextConfig } from "next";

// Бүх хуудсанд: өөр сайтын iframe дотор оруулж хууран мэхлэх (clickjacking), файлын төрлийг хөтөч
// таах, хаягийг гадагш задруулах, камер/микрофон/байршил ашиглахаас сэргийлнэ
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  // Ямар технологи ашигласныг (X-Powered-By: Next.js) зарлахгүй
  poweredByHeader: false,
  images: {
    // Админ хэсгээс upload хийсэн мэдээний зургууд (Vercel Blob) болон YouTube видеоны зураг
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com", port: "", search: "" },
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**", port: "", search: "" },
    ],
  },
  // Сайт ангийн сервер дээр unit013.mn-ээр ажилладаг. Хуучин Vercel хуулбар (өөр өгөгдлийн сантай) Google-д
  // давхардал үүсгэхгүйн тулд бүх хүсэлтийг албан ёсны домэйн руу байнга шилжүүлнэ
  async redirects() {
    return process.env.VERCEL
      ? [{ source: "/:path*", destination: "https://unit013.mn/:path*", permanent: true }]
      : [];
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      {
        // Монгол бичгийн фонт: файлын нэрэнд хувилбар нь орсон тул хөтөч удаан хадгална
        source: "/fonts/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
