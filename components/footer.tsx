import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div className="space-y-4">
            <div className="font-bold tracking-widest text-foreground">
              <span className="text-primary">013</span> АНГИ
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Эх орны бүрэн эрхт байдал, аюулгүй байдлыг хамгаалах үнэнч хамгаалагч
            </p>
          </div>
          <div>
            <h3 className="text-foreground font-bold mb-4">Холбоосууд</h3>
            <ul className="space-y-2">
              <li><Link href="#about" className="text-sm text-muted-foreground hover:text-primary transition-colors">Тухай</Link></li>
              <li><Link href="#training" className="text-sm text-muted-foreground hover:text-primary transition-colors">Сургалт</Link></li>
              <li><Link href="#contact" className="text-sm text-muted-foreground hover:text-primary transition-colors">Холбоо барих</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-foreground font-bold mb-4">Холбоо барих</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <Phone className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>+976 7011-2345</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <Mail className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>info@unit01.mil.mn</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Улаанбаатар, Сүхбаатар дүүрэг</span>
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
            <p className="text-sm text-muted-foreground">© 2025 Цэргийн анги-01. Бүх эрх хуулиар хамгаалагдсан.</p>
            <span className="text-xs text-muted-foreground font-mono">UNIT-01-MIL</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
