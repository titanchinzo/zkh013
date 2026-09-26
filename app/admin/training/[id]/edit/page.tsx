import { notFound } from "next/navigation";
import { connectToDatabase } from "@/lib/mongodb";
import TrainingMaterial from "@/lib/models/TrainingMaterial";
import { requireAdmin } from "@/lib/admin-guard";
import { TrainingMaterialForm } from "@/components/training-material-form";

export const dynamic = "force-dynamic";

export default async function EditTrainingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  await connectToDatabase();
  const item = await TrainingMaterial.findById(id).lean().catch(() => null);
  if (!item) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Материал засах</h1>
      <TrainingMaterialForm
        initial={{
          _id: id,
          title: item.title,
          description: item.description ?? "",
          kind: item.kind as "file" | "link",
          url: item.url,
          fileName: item.fileName ?? "",
          fileExt: item.fileExt ?? "",
          fileSize: item.fileSize ?? 0,
        }}
      />
    </div>
  );
}
