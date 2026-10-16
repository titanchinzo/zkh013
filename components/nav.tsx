import Link from "next/link";
import { getCurrentRole } from "@/lib/auth-role";
import { getTranslator } from "@/lib/mgl/server";
import { NAV_LINKS } from "@/lib/site";
import { Brand } from "@/components/brand";
import { NavMenu } from "@/components/nav-menu";
import { MglNav } from "@/components/mgl/mgl-nav";

export async function Nav() {
  // Уншигчид нэвтрэх шаардлагагүй тул Админ товч нийтэд харагдахгүй.
  // Ажилтнууд /admin хаягаар шууд орж нэвтэрнэ; нэвтэрсэн админ/хянагчид л товч харагдана.
  const [role, { script, t }] = await Promise.all([getCurrentRole(), getTranslator()]);

  if (script === "mgl") {
    const links = NAV_LINKS.map((link) => ({ ...link, label: t(link.label) }));
    return <MglNav links={links} showAdmin={Boolean(role)} adminLabel={t("Админ")} />;
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/85 backdrop-blur border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-4">
          <Link href="/" aria-label="Нүүр хуудас" className="min-w-0">
            <Brand preload />
          </Link>
          <NavMenu links={NAV_LINKS} showAdmin={Boolean(role)} />
        </div>
      </div>
    </nav>
  );
}
