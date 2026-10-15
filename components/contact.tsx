"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { MapPin, Phone, Mail, Clock, type LucideIcon } from "lucide-react";
import { CONTACT } from "@/lib/contact";

const infoCards: { icon: LucideIcon; title: string; text: string; href?: string }[] = [
  { icon: MapPin, title: "Хаяг", text: CONTACT.address },
  { icon: Phone, title: "Утас", text: CONTACT.phone, href: CONTACT.phoneHref },
  { icon: Mail, title: "И-мэйл", text: CONTACT.email, href: `mailto:${CONTACT.email}` },
  { icon: Clock, title: "Цагийн хуваарь", text: "Даваа - Баасан: 09:00 - 18:00" },
];

export function Contact() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // await-ийн дараа e.currentTarget нь null болдог тул формыг урьдчилан авна
    // (өмнө нь амжилттай илгээсэн ч reset() алдаа өгч "Алдаа гарлаа" гэж харуулдаг байсан)
    const formElement = e.currentTarget;
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(formElement))),
      });
      if (res.ok) formElement.reset();
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section id="contact" className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
              ХОЛБОО БАРИХ
            </h2>
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
                <form className="space-y-6" onSubmit={handleSubmit}>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Нэр</label>
                    <Input name="name" placeholder="Таны нэр" required />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">И-мэйл</label>
                    <Input type="email" name="email" placeholder="your@email.com" required />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Гарчиг</label>
                    <Input name="subject" placeholder="Асуулт эсвэл санал" required />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Мессеж</label>
                    <Textarea name="message" placeholder="Таны мессеж..." required />
                  </div>
                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="w-full h-10 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-semibold disabled:opacity-50"
                  >
                    {status === "sending" ? "Илгээж байна..." : "Мессеж илгээх"}
                  </button>
                  {status === "sent" && (
                    <p className="text-sm text-primary text-center">Мессеж амжилттай илгээгдлээ.</p>
                  )}
                  {status === "error" && (
                    <p className="text-sm text-red-400 text-center">Алдаа гарлаа. Дахин оролдоно уу.</p>
                  )}
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
