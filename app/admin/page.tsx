import { connectToDatabase } from "@/lib/mongodb";
import News from "@/lib/models/News";
import ContactMessage from "@/lib/models/ContactMessage";
import TrainingMaterial from "@/lib/models/TrainingMaterial";
import Personnel from "@/lib/models/Personnel";
import Device from "@/lib/models/Device";
import DayRecord from "@/lib/models/DayRecord";
import { auth } from "@clerk/nextjs/server";
import { getCurrentRole } from "@/lib/auth-role";
import { isHrRole, isNewsRole } from "@/lib/roles";
import { todayUb } from "@/lib/hr";

const DESCRIPTIONS = {
  admin: "Танд бүх контент болон хэрэглэгчийн эрхийг удирдах эрх бий.",
  moderator: "Танд шинэ мэдээг хянаж, зөвшөөрөх эрх бий.",
  publisher: "Танд мэдээ бэлтгэж оруулах эрх бий. Таны мэдээ хянагч зөвшөөрсний дараа сайтад нийтлэгдэнэ.",
  hr: "Танд алба хаагчдын ирц, харуул, манаа, утасны бүртгэл, зарлан мэдээллийг удирдах эрх бий.",
};

type Stat = { label: string; value: number | string };

async function newsStats(role: string | null): Promise<Stat[]> {
  const isPublisher = role === "publisher";
  // Нийтлэгчид зөвхөн өөрийн мэдээний тоо харагдана
  const own = isPublisher ? { authorId: (await auth()).userId } : {};
  const [pending, published, rejected] = await Promise.all([
    News.countDocuments({ ...own, status: "pending" }),
    News.countDocuments({ ...own, status: "published" }),
    isPublisher ? News.countDocuments({ ...own, status: "rejected" }) : Promise.resolve(null),
  ]);
  return [
    { label: "Хяналт хүлээж буй мэдээ", value: pending },
    { label: "Нийтлэгдсэн мэдээ", value: published },
    ...(rejected !== null ? [{ label: "Татгалзсан мэдээ", value: rejected }] : []),
  ];
}

async function hrStats(): Promise<Stat[]> {
  const [personnel, pendingDevices, today] = await Promise.all([
    Personnel.countDocuments({ active: true }),
    Device.countDocuments({ status: "pending" }),
    DayRecord.findOne({ date: todayUb() }).select("attendance guard watch").lean<{
      attendance: { status: string }[];
      guard: unknown[];
      watch: unknown[];
    }>(),
  ]);
  return [
    { label: "Алба хаагч", value: personnel },
    { label: "Өнөөдөр ирсэн", value: today ? today.attendance.filter((a) => a.status === "present").length : "—" },
    { label: "Өнөөдрийн харуул / манаа", value: `${today?.guard.length ?? 0} / ${today?.watch.length ?? 0}` },
    { label: "Утасны хүсэлт хүлээгдэж буй", value: pendingDevices },
  ];
}

export default async function AdminDashboard() {
  const role = await getCurrentRole();
  await connectToDatabase();

  const isAdmin = role === "admin";
  const [news, hr, messages, materials] = await Promise.all([
    isNewsRole(role) ? newsStats(role) : Promise.resolve([]),
    isHrRole(role) ? hrStats() : Promise.resolve([]),
    isAdmin ? ContactMessage.countDocuments({}) : Promise.resolve(null),
    isAdmin ? TrainingMaterial.countDocuments({}) : Promise.resolve(null),
  ]);

  const stats: Stat[] = [
    ...news,
    ...(messages !== null ? [{ label: "Ирсэн зурвас", value: messages }] : []),
    ...(materials !== null ? [{ label: "Сургалтын материал", value: materials }] : []),
    ...hr,
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Хянах самбар</h1>
        <p className="text-muted-foreground text-sm mt-1">{role ? DESCRIPTIONS[role] : ""}</p>
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
