import type { MetadataRoute } from "next";

// Утсан дээр суулгадаг "Зарлан мэдээлэх" апп (PWA). Суулгасан апп /app хуудсаар нээгдэнэ — тэнд зөвхөн
// зарлан мэдээлэл, тухайн хүний харуул, манаа харагдана.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "013 анги — Зарлан мэдээлэх",
    short_name: "013 анги",
    description: "Зэвсэгт хүчний 013 дугаар ангийн алба хаагчдад зориулсан зарлан мэдээлэл",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#0a0f0a",
    theme_color: "#0a0f0a",
    lang: "mn",
    icons: [
      { src: "/app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
