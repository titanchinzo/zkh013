import { Card, CardContent } from "@/components/ui/card";
import { Shield, Target, Award } from "lucide-react";

const values = [
  {
    icon: Shield,
    title: "Сахилга бат",
    text: "Өндөр сахилга батыг хангах, цэргийн дүрэм журмыг чанд мөрдүүлэх",
  },
  {
    icon: Target,
    title: "Үүрэг хариуцлага",
    text: "Эх орон, ард түмнээ үнэнчээр үйлчлэх, даалгаврыг гүйцэтгэх",
  },
  {
    icon: Award,
    title: "Эх оронч үзэл",
    text: "Эх орны бүрэн эрхт байдлыг хамгаалах дээд зорилгыг дэмжих",
  },
];

export function About() {
  return (
    <section id="about" className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
              АНГИЙН ТУХАЙ
            </h2>
            <div className="w-20 h-1 bg-primary mx-auto" />
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-primary mb-3">Товч түүх</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Манай анги 1970-аад онд байгуулагдсан бөгөөд эх орны бүрэн эрхт байдал, аюулгүй байдлыг
                  хамгаалахад гол үүрэг гүйцэтгэж ирсэн. Олон жилийн турш олон улсын болон дотоодын олон арга
                  хэмжээнд амжилттай оролцож ирсэн түүхтэй.
                </p>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-primary mb-3">Үндсэн чиг үүрэг</h3>
                <ul className="space-y-2 text-muted-foreground">
                  {[
                    "Эх орны бүрэн эрхт байдлыг хамгаалах",
                    "Аюулгүй байдлыг хангах үйл ажиллагаа явуулах",
                    "Иргэдийн амь нас, эд хөрөнгийг хамгаалах",
                    "Олон улсын энхийг сахиулах ажиллагаанд оролцох",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-primary mt-1">▸</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-6">
              <div className="border border-border bg-card p-6 metallic rounded-xl">
                <h3 className="text-2xl font-bold text-primary mb-3">Алсын хараа</h3>
                <p className="text-muted-foreground leading-relaxed">
                  &quot;Орчин үеийн техник, технологи, өндөр бэлтгэл бүхий цэргийн анги болж, эх орны аюулгүй
                  байдлыг бүх талаар хангах&quot;
                </p>
              </div>
              <div className="border border-border bg-card p-6 metallic rounded-xl">
                <h3 className="text-2xl font-bold text-primary mb-3">Эрхэм зорилго</h3>
                <p className="text-muted-foreground leading-relaxed">
                  &quot;Үнэнч, чадварлаг, эх оронч цэргийн хүч бий болгож, ард түмнээ үнэнчээр үйлчлэх&quot;
                </p>
              </div>
              <div className="border border-primary/30 bg-primary/5 p-4 text-center rounded-xl">
                <p className="text-xl font-bold text-primary tracking-wider">
                  &quot;АЛБАН ҮҮРЭГ • НЭРИЙН ТӨЛӨӨ • ЭРЭЛХЭГ БАЙХ&quot;
                </p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {values.map(({ icon: Icon, title, text }) => (
              <Card key={title} className="hover:border-primary/50 transition-all duration-300">
                <CardContent className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 border-2 border-primary bg-primary/10 flex items-center justify-center">
                    <Icon className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
