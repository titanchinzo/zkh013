"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { MapPin, Phone, Mail, Clock } from "lucide-react";

const infoCards = [
  { icon: MapPin, title: "Хаяг", text: "Улаанбаатар хот, Сүхбаатар дүүрэг, Цэргийн хороолол-1" },
  { icon: Phone, title: "Утас", text: "+976 7011-2345 / +976 7011-2346" },
  { icon: Mail, title: "И-мэйл", text: "info@unit01.mil.mn" },
  { icon: Clock, title: "Цагийн хуваарь", text: "Даваа - Баасан: 09:00 - 18:00" },
];

export function Contact() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      setStatus(res.ok ? "sent" : "error");
      if (res.ok) e.currentTarget.reset();
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
              {infoCards.map(({ icon: Icon, title, text }) => (
                <Card key={title} className="hover:border-primary transition-colors">
                  <CardContent className="flex items-start gap-4">
                    <div className="w-12 h-12 border border-primary bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground mb-1">{title}</h3>
                      <p className="text-muted-foreground">{text}</p>
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
