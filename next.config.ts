import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Админ хэсгээс upload хийсэн мэдээний зургууд (Vercel Blob) болон YouTube видеоны зураг
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com", port: "", search: "" },
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**", port: "", search: "" },
    ],
  },
};

export default nextConfig;
