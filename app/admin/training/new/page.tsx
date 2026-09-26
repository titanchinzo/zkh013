import { requireAdmin } from "@/lib/admin-guard";
import { TrainingMaterialForm } from "@/components/training-material-form";

export default async function NewTrainingPage() {
  await requireAdmin();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Шинэ сургалтын материал</h1>
      <p className="text-sm text-muted-foreground">
        Хадгалмагц нүүр хуудасны &quot;Сургалтын материал&quot; хэсэгт шууд гарна.
      </p>
      <TrainingMaterialForm />
    </div>
  );
}
