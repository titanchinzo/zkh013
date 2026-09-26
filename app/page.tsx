import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { About } from "@/components/about";
import { Training } from "@/components/training";
import { Contact } from "@/components/contact";
import { Footer } from "@/components/footer";

// Hero-ийн мэдээний зураг болон сургалтын материалыг хүсэлт бүрд өгөгдлийн сангаас татдаг
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main>
        <Hero />
        <About />
        <Training />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
