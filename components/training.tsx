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
import { MglHeading } from "@/components/mgl/mgl-heading";
import { MglBand } from "@/components/mgl/mgl-ornaments";
import { toMgl } from "@/lib/mgl/convert";
import { getTranslator } from "@/lib/mgl/server";

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

function materialMeta(m: Material, linkLabel: string) {
  const isLink = m.kind === "link";
  return {
    Icon: isLink ? Link2 : (ICONS[m.fileExt] ?? FileText),
    ActionIcon: isLink ? ExternalLink : Download,
    typeLabel: isLink
      ? linkLabel
      : (TRAINING_FILE_TYPES[m.fileExt as TrainingFileExt]?.label ?? m.fileExt.toUpperCase()),
  };
}

export async function Training() {
  const [materials, { script, t }] = await Promise.all([getMaterials(), getTranslator()]);

  if (script === "mgl") {
    const converted = await toMgl(materials.flatMap((m) => [m.title, m.description ?? ""]));
    return (
      <section id="training" className="py-20 md:py-32 bg-muted/30 tactical-grid">
        <div className="container mx-auto px-4">
          <MglBand className="mx-auto mb-12 max-w-6xl md:mb-16" />
          <div className="max-w-6xl mx-auto flex flex-col gap-10 lg:flex-row">
            <div className="flex shrink-0 flex-row gap-4">
              <MglHeading title={t("СУРГАЛТЫН МАТЕРИАЛ")} />
              <p className="mgl-v h-72 text-base leading-relaxed text-muted-foreground">
                {t("Цэргийн албанд шаардлагатай заавар, маягт, баримт бичгийн цогц")}
              </p>
            </div>

            {materials.length === 0 ? (
              <p className="mgl-v h-60 text-muted-foreground">{t("Одоогоор сургалтын материал алга байна.")}</p>
            ) : (
              <div className="grid min-w-0 flex-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {materials.map((m, index) => {
                  const { Icon, ActionIcon, typeLabel } = materialMeta(m, t("Холбоос"));
                  return (
                    <a
                      key={String(m._id)}
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex h-72 flex-row gap-3 overflow-hidden rounded-xl border border-border bg-card p-5 metallic transition-all duration-300 hover:border-primary"
                    >
                      <span className="flex shrink-0 flex-col items-center gap-3">
                        <span className="flex h-12 w-12 items-center justify-center border-2 border-primary bg-primary/10 transition-colors group-hover:bg-primary/20">
                          <Icon className="h-6 w-6 text-primary" />
                        </span>
                        <span className="mgl-v inline-flex items-center gap-1 text-xs text-primary">
                          <ActionIcon className="h-3.5 w-3.5" />
                          {typeLabel}
                          {m.fileSize > 0 && <span className="text-muted-foreground">{formatFileSize(m.fileSize)}</span>}
                        </span>
                      </span>
                      <span className="mgl-v line-clamp-3 text-lg leading-snug text-foreground transition-colors group-hover:text-primary">
                        {converted[index * 2]}
                      </span>
                      {m.description && (
                        <span className="mgl-v line-clamp-4 text-sm leading-relaxed text-muted-foreground">
                          {converted[index * 2 + 1]}
                        </span>
                      )}
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
                const { Icon, ActionIcon, typeLabel } = materialMeta(m, "Холбоос");
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
