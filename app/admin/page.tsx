import Link from "next/link";
import { connectToDatabase } from "@/lib/mongodb";
import News from "@/lib/models/News";
import ContactMessage from "@/lib/models/ContactMessage";
import TrainingMaterial from "@/lib/models/TrainingMaterial";
import Personnel from "@/lib/models/Personnel";
import Device from "@/lib/models/Device";
import DayRecord, { dutyIds } from "@/lib/models/DayRecord";
import { auth } from "@clerk/nextjs/server";
import { getCurrentRole } from "@/lib/auth-role";
import { isHrRole, isNewsRole } from "@/lib/roles";
import { todayUb } from "@/lib/hr";

const DESCRIPTIONS = {
  admin: "Танд бүх контент болон хэрэглэгчийн эрхийг удирдах эрх бий.",
  moderator: "Танд шинэ мэдээг хянаж, зөвшөөрөх эрх бий.",
  publisher: "Танд мэдээ бэлтгэж оруулах эрх бий. Таны мэдээ хянагч зөвшөөрсний дараа сайтад нийтлэгдэнэ.",
  hr: "Танд алба хаагчдын ирц, харуул хоногийн манаа, утасны бүртгэл, зарлан мэдээллийг удирдах эрх бий.",
};

// Карт бүр дээр дарахад тухайн хэсэг рүү орно
type Stat = { label: string; value: number | string; href: string };

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
    { label: "Хяналт хүлээж буй мэдээ", value: pending, href: "/admin/news?status=pending" },
    { label: "Нийтлэгдсэн мэдээ", value: published, href: "/admin/news?status=published" },
    ...(rejected !== null ? [{ label: "Татгалзсан мэдээ", value: rejected, href: "/admin/news?status=rejected" }] : []),
  ];
}

async function hrStats(): Promise<Stat[]> {
  const [personnel, pendingDevices, today] = await Promise.all([
    Personnel.countDocuments({ active: true }),
    Device.countDocuments({ status: "pending" }),
    DayRecord.findOne({ date: todayUb() }).select("attendance guard watch").lean<{
      attendance?: { status: string }[];
      guard?: unknown[];
      watch?: unknown[];
    }>(),
  ]);
  const present = today?.attendance?.length ? today.attendance.filter((a) => a.status === "present").length : "—";
  return [
    { label: "Алба хаагч", value: personnel, href: "/admin/personnel" },
    { label: "Өнөөдөр ирсэн", value: present, href: "/admin/attendance" },
    { label: "Өнөөдөр харуул хоногийн манаанд", value: dutyIds(today).length, href: "/admin/attendance" },
    { label: "Утасны хүсэлт хүлээгдэж буй", value: pendingDevices, href: "/admin/devices" },
  ];
}

export default async function AdminDashboard() {
  const role = await getCurrentRole();
  await connectToDatabase();

  const isAdmin = role === "admin";
  const [news, hr, messages, unread, materials] = await Promise.all([
    isNewsRole(role) ? newsStats(role) : Promise.resolve([]),
    isHrRole(role) ? hrStats() : Promise.resolve([]),
    isAdmin ? ContactMessage.countDocuments({}) : Promise.resolve(null),
    isAdmin ? ContactMessage.countDocuments({ read: false }) : Promise.resolve(0),
    isAdmin ? TrainingMaterial.countDocuments({}) : Promise.resolve(null),
  ]);

  const stats: Stat[] = [
    ...news,
    ...(messages !== null
      ? [{ label: unread ? `Ирсэн зурвас · ${unread} уншаагүй` : "Ирсэн зурвас", value: messages, href: "/admin/messages" }]
      : []),
    ...(materials !== null ? [{ label: "Сургалтын материал", value: materials, href: "/admin/training" }] : []),
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
          <Link
            key={s.label}
            href={s.href}
            className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/60 hover:bg-muted/40"
          >
            <p className="text-3xl font-bold text-primary">{s.value}</p>
            <p className="text-sm text-muted-foreground mt-1 group-hover:text-foreground">
              {s.label} <span aria-hidden>→</span>
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
