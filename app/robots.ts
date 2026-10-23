import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Хайлтын системүүд нийтийн хуудсыг уншина; админ, нэвтрэх хуудас, API-г хайлтад оруулахгүй
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/sign-in", "/sign-up"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
