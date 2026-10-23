import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { LatestNews } from "@/components/latest-news";
import { About } from "@/components/about";
import { Training } from "@/components/training";
import { Contact } from "@/components/contact";
import { Footer } from "@/components/footer";
import { CONTACT } from "@/lib/contact";
import { SITE_NAME, SITE_URL } from "@/lib/site";

// Hero-ийн мэдээний зураг, сүүлийн мэдээ, сургалтын материалыг хүсэлт бүрд өгөгдлийн сангаас татдаг
export const dynamic = "force-dynamic";

export const metadata: Metadata = { alternates: { canonical: "/" } };

// Google-д сайтын нэр болон албан ёсны байгууллагыг таниулна (хайлтын үр дүнд гарах нэр, лого)
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      alternateName: ["ЗХ-ний 013 дугаар анги", "013 дугаар анги"],
      inLanguage: "mn",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "GovernmentOrganization",
      "@id": `${SITE_URL}/#organization`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      alternateName: "Хошууч генерал Р.Гаваагийн нэрэмжит Зэвсэгт хүчний 013 дугаар анги",
      logo: `${SITE_URL}/icon.png`,
      image: `${SITE_URL}/og-image.jpg`,
      email: CONTACT.email,
      telephone: CONTACT.phoneHref.replace("tel:", ""),
      address: { "@type": "PostalAddress", streetAddress: CONTACT.address, addressCountry: "MN" },
    },
  ],
};

export default function Home() {
  return (
    <div className="min-h-screen bg-background mgl:md:pl-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }}
      />
      <Nav />
      <main>
        <Hero />
        <LatestNews />
        <About />
        <Training />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
