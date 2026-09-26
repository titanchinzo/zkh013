import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Админ хэсгээс upload хийсэн мэдээний зургууд (Vercel Blob)
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com", port: "", search: "" },
    ],
  },
};

export default nextConfig;
