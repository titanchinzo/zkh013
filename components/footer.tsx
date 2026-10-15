import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";
import { Brand } from "@/components/brand";
import { CONTACT } from "@/lib/contact";
import { SITE_NAME } from "@/lib/site";

export function Footer() {
  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-4 py-12">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="space-y-4">
            <Link href="/" aria-label="Нүүр хуудас" className="inline-block">
              <Brand />
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Эх орны бүрэн эрхт байдал, аюулгүй байдлыг хамгаалах үнэнч хамгаалагч
            </p>
          </div>
          <div>
            <h3 className="text-foreground font-bold mb-4">Холбоосууд</h3>
            <ul className="space-y-2">
              <li><Link href="/#about" className="text-sm text-muted-foreground hover:text-primary transition-colors">Тухай</Link></li>
              <li><Link href="/news" className="text-sm text-muted-foreground hover:text-primary transition-colors">Мэдээ</Link></li>
              <li><Link href="/#training" className="text-sm text-muted-foreground hover:text-primary transition-colors">Сургалт</Link></li>
              <li><Link href="/#contact" className="text-sm text-muted-foreground hover:text-primary transition-colors">Холбоо барих</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-foreground font-bold mb-4">Холбоо барих</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <Phone className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <a href={CONTACT.phoneHref} className="hover:text-primary transition-colors">
                  {CONTACT.phone}
                </a>
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <Mail className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <a href={`mailto:${CONTACT.email}`} className="break-all hover:text-primary transition-colors">
                  {CONTACT.email}
                </a>
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>{CONTACT.address}</span>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-foreground font-bold mb-4">Цагийн хуваарь</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Даваа - Баасан</p>
              <p className="text-primary font-semibold">09:00 - 18:00</p>
              <p className="mt-4">Бямба - Ням</p>
              <p>Амралтын өдөр</p>
            </div>
          </div>
        </div>
        <div className="pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground text-center md:text-left">
              © {new Date().getFullYear()} {SITE_NAME}. Бүх эрх хуулиар хамгаалагдсан.
            </p>
            <span className="text-xs text-muted-foreground font-mono">ZKH-013</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
