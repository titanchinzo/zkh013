import {
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Link2,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import { connectToDatabase } from "@/lib/mongodb";
import TrainingMaterial from "@/lib/models/TrainingMaterial";
import { TRAINING_FILE_TYPES, formatFileSize, type TrainingFileExt } from "@/lib/training";

type Material = {
  _id: unknown;
  title: string;
  description: string;
  kind: "file" | "link";
  url: string;
  fileExt: string;
  fileSize: number;
};

const ICONS: Record<string, LucideIcon> = {
  ppt: Presentation,
  pptx: Presentation,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
};

async function getMaterials(): Promise<Material[]> {
  try {
    await connectToDatabase();
    return (await TrainingMaterial.find().sort({ createdAt: -1 }).lean()) as unknown as Material[];
  } catch (err) {
    // Өгөгдөл уншиж чадахгүй бол нүүр хуудсыг унагахгүй
    console.error("[training] материал татаж чадсангүй:", err);
    return [];
  }
}

export async function Training() {
  const materials = await getMaterials();

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

          {materials.length === 0 ? (
            <p className="text-center text-muted-foreground">Одоогоор сургалтын материал алга байна.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {materials.map((m) => {
                const isLink = m.kind === "link";
                const Icon = isLink ? Link2 : (ICONS[m.fileExt] ?? FileText);
                const ActionIcon = isLink ? ExternalLink : Download;
                const typeLabel = isLink
                  ? "Холбоос"
                  : (TRAINING_FILE_TYPES[m.fileExt as TrainingFileExt]?.label ?? m.fileExt.toUpperCase());
                return (
                  <a
                    key={String(m._id)}
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block border border-border bg-card hover:border-primary transition-all duration-300 metallic group rounded-xl"
                  >
                    <div className="p-6 md:p-8 flex items-start gap-4">
                      <div className="w-14 h-14 flex-shrink-0 border-2 border-primary bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Icon className="w-7 h-7 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                          {m.title}
                        </h3>
                        {m.description && (
                          <p className="text-muted-foreground leading-relaxed text-sm">{m.description}</p>
                        )}
                        <p className="flex items-center gap-2 text-xs font-semibold text-primary">
                          <ActionIcon className="w-3.5 h-3.5" />
                          {typeLabel}
                          {m.fileSize > 0 && (
                            <span className="font-normal text-muted-foreground">
                              {formatFileSize(m.fileSize)}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
