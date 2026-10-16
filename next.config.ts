import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Админ хэсгээс upload хийсэн мэдээний зургууд (Vercel Blob) болон YouTube видеоны зураг
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com", port: "", search: "" },
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**", port: "", search: "" },
    ],
  },
  async headers() {
    return [
      {
        // Монгол бичгийн фонт: файлын нэрэнд хувилбар нь орсон тул хөтөч удаан хадгална
        source: "/fonts/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
