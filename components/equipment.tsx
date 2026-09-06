"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, Radio, Dumbbell, ShieldHalf, Plane, Cross } from "lucide-react";

const categories = ["All", "Vehicle", "Equipment", "Training"] as const;

const items = [
  {
    icon: Truck,
    title: "Тактикийн машин",
    description: "Орчин үеийн бүх газар явагч цэргийн тээврийн хэрэгсэл. Өндөр даац, бат бөх бүтэцтэй.",
    category: "Vehicle",
  },
  {
    icon: Radio,
    title: "Холбооны систем",
    description: "Дижитал радио холбооны орчин үеийн систем. Найдвартай холбоо харилцааг хангадаг.",
    category: "Equipment",
  },
  {
    icon: Dumbbell,
    title: "Сургалтын тоног төхөөрөмж",
    description: "Симуляцийн сургалтын орчин үеийн систем. Бодит нөхцөлд дөхүүлсэн сургалт.",
    category: "Training",
  },
  {
    icon: ShieldHalf,
    title: "Хамгаалалтын хэрэгсэл",
    description: "Орчин үеийн хувийн хамгаалалтын хэрэгсэл. Өндөр түвшний хамгаалалт үзүүлнэ.",
    category: "Equipment",
  },
  {
    icon: Plane,
    title: "Нисдэг төхөөрөмж",
    description: "Тагнуулын нисдэг төхөөрөмж. Бодит цагийн мэдээлэл цуглуулна.",
    category: "Vehicle",
  },
  {
    icon: Cross,
    title: "Анхны тусламжийн иж бүрдэл",
    description: "Тактикийн анхны тусламжийн хэрэгсэл. Яаралтай үед ашиглана.",
    category: "Equipment",
  },
];

export function Equipment() {
  const [active, setActive] = useState<(typeof categories)[number]>("All");
  const filtered = active === "All" ? items : items.filter((i) => i.category === active);

  return (
    <section id="equipment" className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
              ЗЭВСЭГ ТЕХНИК
            </h2>
            <div className="w-20 h-1 bg-primary mx-auto mb-6" />
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Манай ангийн ашигладаг орчин үеийн цэргийн техник, тоног төхөөрөмж
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className={`px-4 py-2 text-sm font-semibold border rounded-md transition-colors ${
                  active === cat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(({ icon: Icon, title, description, category }) => (
              <Card
                key={title}
                className="hover:border-primary transition-all duration-300 group overflow-hidden"
              >
                <div className="relative h-40 bg-muted tactical-grid flex items-center justify-center">
                  <Icon className="w-14 h-14 text-primary/70 group-hover:scale-110 transition-transform" />
                  <Badge className="absolute top-2 right-2">{category}</Badge>
                </div>
                <CardContent>
                  <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                    {title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
