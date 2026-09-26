import Link from "next/link";
import { connectToDatabase } from "@/lib/mongodb";
import TrainingMaterial from "@/lib/models/TrainingMaterial";
import { requireAdmin } from "@/lib/admin-guard";
import { TRAINING_FILE_TYPES, formatFileSize, type TrainingFileExt } from "@/lib/training";
import { DeleteTrainingButton } from "./delete-button";

export const dynamic = "force-dynamic";

type Row = {
  _id: unknown;
  title: string;
  description: string;
  kind: "file" | "link";
  url: string;
  fileName: string;
  fileExt: string;
  fileSize: number;
  createdAt: Date;
};

export default async function AdminTrainingPage() {
  await requireAdmin();
  await connectToDatabase();
  const items = (await TrainingMaterial.find().sort({ createdAt: -1 }).lean()) as unknown as Row[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Сургалтын материал</h1>
        <Link
          href="/admin/training/new"
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold"
        >
          + Шинэ материал
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Материал алга байна. Нэмсэн материал нүүр хуудасны &quot;Сургалтын материал&quot; хэсэгт шууд
          харагдана.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const id = String(item._id);
            const typeLabel =
              item.kind === "link"
                ? "Холбоос"
                : (TRAINING_FILE_TYPES[item.fileExt as TrainingFileExt]?.label ?? item.fileExt.toUpperCase());
            return (
              <div
                key={id}
                className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase mb-1 text-primary">
                    {typeLabel}
                    {item.fileSize > 0 && (
                      <span className="text-muted-foreground normal-case ml-2">
                        {formatFileSize(item.fileSize)}
                      </span>
                    )}
                  </p>
                  <h2 className="font-bold text-foreground">{item.title}</h2>
                  {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                  )}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground/80 hover:text-primary break-all"
                  >
                    {item.kind === "file" ? item.fileName || "Файл нээх" : item.url}
                  </a>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <Link
                    href={`/admin/training/${id}/edit`}
                    className="px-3 py-1.5 text-xs font-semibold rounded-md border border-border text-center text-foreground"
                  >
                    Засах
                  </Link>
                  <DeleteTrainingButton id={id} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
