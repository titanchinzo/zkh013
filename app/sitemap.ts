import type { MetadataRoute } from "next";
import { getPublishedNewsDates } from "@/lib/news";
import { SITE_URL } from "@/lib/site";

// Google-д сайтын бүх нийтийн хуудсыг (нүүр, мэдээ) жагсааж өгнө. Шинэ мэдээ шууд орохын тулд build хийх
// үед биш, хүсэлт бүрд өгөгдлийн сангаас үүсгэнэ
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const news = await getPublishedNewsDates();
  const latest = news.length ? new Date(Math.max(...news.map((item) => item.lastModified.getTime()))) : undefined;
  return [
    { url: `${SITE_URL}/`, lastModified: latest },
    { url: `${SITE_URL}/news`, lastModified: latest },
    ...news.map((item) => ({ url: `${SITE_URL}/news/${item.id}`, lastModified: item.lastModified })),
  ];
}
