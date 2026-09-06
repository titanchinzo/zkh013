import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { About } from "@/components/about";
import { Equipment } from "@/components/equipment";
import { Training } from "@/components/training";
import { Contact } from "@/components/contact";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main>
        <Hero />
        <About />
        <Equipment />
        <Training />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
