import { MapPin, Phone, Mail, Clock, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ContactForm } from "@/components/contact-form";
import { MglHeading } from "@/components/mgl/mgl-heading";
import { MglBand } from "@/components/mgl/mgl-ornaments";
import { CONTACT } from "@/lib/contact";
import { getTranslator } from "@/lib/mgl/server";

export async function Contact() {
  const { script, t } = await getTranslator();
  const mgl = script === "mgl";

  const infoCards: { icon: LucideIcon; title: string; text: string; href?: string }[] = [
    { icon: MapPin, title: t("Хаяг"), text: t(CONTACT.address) },
    { icon: Phone, title: t("Утас"), text: CONTACT.phone, href: CONTACT.phoneHref },
    { icon: Mail, title: t("И-мэйл"), text: CONTACT.email, href: `mailto:${CONTACT.email}` },
    { icon: Clock, title: t("Цагийн хуваарь"), text: t("Даваа - Баасан: 09:00 - 18:00") },
  ];
  const labels = {
    name: t("Нэр"),
    email: t("И-мэйл"),
    subject: t("Гарчиг"),
    message: t("Мессеж"),
    namePlaceholder: t("Таны нэр"),
    subjectPlaceholder: t("Асуулт эсвэл санал"),
    messagePlaceholder: t("Таны мессеж..."),
    submit: t("Мессеж илгээх"),
    sending: t("Илгээж байна..."),
    sent: t("Мессеж амжилттай илгээгдлээ."),
    error: t("Алдаа гарлаа. Дахин оролдоно уу."),
  };

  if (mgl) {
    return (
      <section id="contact" className="py-20 md:py-32 bg-background">
        <div className="container mx-auto px-4">
          <MglBand className="mx-auto mb-12 max-w-6xl md:mb-16" />
          <div className="max-w-6xl mx-auto flex flex-col gap-10 lg:flex-row">
            <div className="flex shrink-0 flex-row gap-4">
              <MglHeading title={t("ХОЛБОО БАРИХ")} />
              <p className="mgl-v h-72 text-base leading-relaxed text-muted-foreground">
                {t("Бидэнтэй холбогдох, асуулт тавих, санал хүсэлтээ илгээх")}
              </p>
            </div>
            <div className="grid min-w-0 flex-1 gap-6 xl:grid-cols-[auto_minmax(0,1fr)]">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-2">
                {infoCards.map(({ icon: Icon, title, text, href }) => (
                  <Card key={title} className="transition-colors hover:border-primary">
                    <CardContent className="flex h-56 flex-col items-center gap-3 p-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-primary bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </span>
                      <span className="flex min-h-0 flex-1 flex-row gap-2">
                        <span className="mgl-v text-sm text-foreground">{title}</span>
                        {href ? (
                          <a href={href} className="mgl-v text-sm text-muted-foreground transition-colors hover:text-primary">
                            {text}
                          </a>
                        ) : (
                          <span className="mgl-v text-sm text-muted-foreground">{text}</span>
                        )}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card>
                <CardContent>
                  <ContactForm labels={labels} vertical />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="contact" className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">ХОЛБОО БАРИХ</h2>
            <div className="w-20 h-1 bg-primary mx-auto mb-6" />
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Бидэнтэй холбогдох, асуулт тавих, санал хүсэлтээ илгээх
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            <div className="space-y-4">
              {infoCards.map(({ icon: Icon, title, text, href }) => (
                <Card key={title} className="hover:border-primary transition-colors">
                  <CardContent className="flex items-start gap-4">
                    <div className="w-12 h-12 border border-primary bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-foreground mb-1">{title}</h3>
                      {href ? (
                        <a href={href} className="break-all text-muted-foreground hover:text-primary transition-colors">
                          {text}
                        </a>
                      ) : (
                        <p className="text-muted-foreground">{text}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardContent>
                <ContactForm labels={labels} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
