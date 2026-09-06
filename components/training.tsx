import { FileText, Clipboard, BookOpen, Users } from "lucide-react";

const materials = [
  {
    icon: FileText,
    title: "3 үеийн намтар бичих заавар",
    text: "Хувийн болон гэр бүлийн 3 үеийн түүхийг бүртгэх, баримт бичгийг бүрдүүлэх заавар",
  },
  {
    icon: Clipboard,
    title: "Төрийн албан хаагчийн маягт",
    text: "Төрийн албанд ажиллахад шаардлагатай бүх төрлийн маягт, баримт бичгийн загварууд",
  },
  {
    icon: BookOpen,
    title: "Бичих заавар",
    text: "Албан ёсны бичиг баримт, тайлан, тушаал, захирамж зэрэг баримтын бичих дүрэм журам",
  },
  {
    icon: Users,
    title: "Телеграфийн дамжаа",
    text: "Цэргийн телеграф, кодлох арга, нууцлал хадгалах, мэдээлэл дамжуулах заавар",
  },
];

export function Training() {
  return (
    <section id="training" className="py-20 md:py-32 bg-muted/30 tactical-grid">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
              СУРГАЛТЫН МАТЕРИАЛ
            </h2>
            <div className="w-20 h-1 bg-primary mx-auto mb-6" />
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Цэргийн албанд шаардлагатай заавар, маягт, баримт бичгийн цогц
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {materials.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="border border-border bg-card hover:border-primary transition-all duration-300 metallic group cursor-pointer rounded-xl"
              >
                <div className="p-6 md:p-8 flex items-start gap-4">
                  <div className="w-14 h-14 flex-shrink-0 border-2 border-primary bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-7 h-7 text-primary" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                      {title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed text-sm">{text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
