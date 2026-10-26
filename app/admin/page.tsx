import { connectToDatabase } from "@/lib/mongodb";
import News from "@/lib/models/News";
import ContactMessage from "@/lib/models/ContactMessage";
import TrainingMaterial from "@/lib/models/TrainingMaterial";
import { auth } from "@clerk/nextjs/server";
import { getCurrentRole } from "@/lib/auth-role";

export default async function AdminDashboard() {
  const role = await getCurrentRole();
  await connectToDatabase();

  const isAdmin = role === "admin";
  const isPublisher = role === "publisher";
  // Нийтлэгчид зөвхөн өөрийн мэдээний тоо харагдана
  const own = isPublisher ? { authorId: (await auth()).userId } : {};
  const [pending, published, rejected, messages, materials] = await Promise.all([
    News.countDocuments({ ...own, status: "pending" }),
    News.countDocuments({ ...own, status: "published" }),
    isPublisher ? News.countDocuments({ ...own, status: "rejected" }) : Promise.resolve(null),
    isAdmin ? ContactMessage.countDocuments({}) : Promise.resolve(null),
    isAdmin ? TrainingMaterial.countDocuments({}) : Promise.resolve(null),
  ]);

  const stats = [
    { label: "Хяналт хүлээж буй мэдээ", value: pending },
    { label: "Нийтлэгдсэн мэдээ", value: published },
    ...(rejected !== null ? [{ label: "Татгалзсан мэдээ", value: rejected }] : []),
    ...(messages !== null ? [{ label: "Ирсэн зурвас", value: messages }] : []),
    ...(materials !== null ? [{ label: "Сургалтын материал", value: materials }] : []),
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Хянах самбар</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {role === "admin"
            ? "Танд бүх контент болон хэрэглэгчийн эрхийг удирдах эрх бий."
            : role === "moderator"
              ? "Танд шинэ мэдээг хянаж, зөвшөөрөх эрх бий."
              : "Танд мэдээ бэлтгэж оруулах эрх бий. Таны мэдээ хянагч зөвшөөрсний дараа сайтад нийтлэгдэнэ."}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-6">
            <p className="text-3xl font-bold text-primary">{s.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
