import Image from "next/image";
import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";
import logo from "@/public/logo.png";
import { Brand } from "@/components/brand";
import { MglBand } from "@/components/mgl/mgl-ornaments";
import { CONTACT } from "@/lib/contact";
import { getTranslator, type Translate } from "@/lib/mgl/server";
import { mglDigits } from "@/lib/mgl/shared";
import { SITE_NAME } from "@/lib/site";

const FOOTER_LINKS = [
  { href: "/#about", label: "Тухай" },
  { href: "/news", label: "Мэдээ" },
  { href: "/#training", label: "Сургалт" },
  { href: "/#contact", label: "Холбоо барих" },
];

export async function Footer() {
  const { script, t } = await getTranslator();
  if (script === "mgl") return <MglFooter t={t} />;

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
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
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

/**
 * Монгол бичгийн горимын footer: бүлэг бүр босоо гарчиг, босоо мөрүүдтэй, зүүнээс баруун тийш эгнэнэ;
 * багтахгүй бол дараагийн мөрөнд (доошоо) шилжинэ.
 */
function MglFooter({ t }: { t: Translate }) {
  const group = "flex h-72 shrink-0 flex-row gap-3 border-l border-border pl-5 first:border-0 first:pl-0";
  const heading = "mgl-v text-base text-foreground";
  const item = "mgl-v text-sm text-muted-foreground transition-colors hover:text-primary";

  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-4 py-12">
        <MglBand className="mb-10" />
        <div className="flex flex-row flex-wrap gap-x-6 gap-y-10">
          <div className={group}>
            <Link href="/" aria-label="Нүүр хуудас" className="flex shrink-0 flex-col items-center gap-3">
              <Image src={logo} alt="Зэвсэгт хүчний 013 дугаар ангийн лого" sizes="48px" className="h-14 w-auto" />
              <span className="mgl-v text-base text-foreground">
                {t("ЗЭВСЭГТ ХҮЧНИЙ")} <span className="text-primary">{mglDigits("013")}</span>
              </span>
            </Link>
            <p className="mgl-v text-sm leading-relaxed text-muted-foreground">
              {t("Эх орны бүрэн эрхт байдал, аюулгүй байдлыг хамгаалах үнэнч хамгаалагч")}
            </p>
          </div>

          <div className={group}>
            <h3 className={heading}>{t("Холбоосууд")}</h3>
            {FOOTER_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={item}>
                {t(link.label)}
              </Link>
            ))}
          </div>

          <div className={group}>
            <h3 className={heading}>{t("Холбоо барих")}</h3>
            <a href={CONTACT.phoneHref} className={`${item} inline-flex items-center gap-2`}>
              <Phone className="h-4 w-4 text-primary" />
              {mglDigits(CONTACT.phone)}
            </a>
            <a href={`mailto:${CONTACT.email}`} className={`${item} inline-flex items-center gap-2`}>
              <Mail className="h-4 w-4 text-primary" />
              {CONTACT.email}
            </a>
            <span className={`${item} inline-flex items-center gap-2`}>
              <MapPin className="h-4 w-4 text-primary" />
              {t(CONTACT.address)}
            </span>
          </div>

          <div className={group}>
            <h3 className={heading}>{t("Цагийн хуваарь")}</h3>
            <span className="mgl-v text-sm text-muted-foreground">{t("Даваа - Баасан")}</span>
            <span className="mgl-v text-sm text-primary">{mglDigits("09:00 - 18:00")}</span>
            <span className="mgl-v text-sm text-muted-foreground">{t("Бямба - Ням")}</span>
            <span className="mgl-v text-sm text-muted-foreground">{t("Амралтын өдөр")}</span>
          </div>

          <div className={group}>
            <p className="mgl-v text-xs leading-relaxed text-muted-foreground">
              © {mglDigits(String(new Date().getFullYear()))} {t(SITE_NAME)}. {t("Бүх эрх хуулиар хамгаалагдсан.")}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
