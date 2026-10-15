// Сайтын ерөнхий мэдээлэл (metadata, хуваалцах холбоос зэрэгт ашиглана)

export const SITE_NAME = "Зэвсэгт хүчний 013 дугаар анги";

// Vercel production дээр төслийн үндсэн домэйныг автоматаар авна (өөр домэйн холбовол түүнийг)
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

// Сайтын холбоосыг хуваалцахад гарах зураг (public/og-image.jpg)
export const SITE_OG_IMAGE = { url: "/og-image.jpg", width: 1200, height: 630, alt: SITE_NAME };

export const NAV_LINKS = [
  { href: "/", label: "Нүүр" },
  { href: "/#about", label: "Тухай" },
  { href: "/news", label: "Мэдээ" },
  { href: "/#training", label: "Сургалт" },
  { href: "/#contact", label: "Холбоо барих" },
];
