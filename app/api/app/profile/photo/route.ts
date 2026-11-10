import { NextRequest, NextResponse } from "next/server";
import { getApprovedDevice } from "@/lib/device";
import Personnel from "@/lib/models/Personnel";
import { deleteFile, saveFile } from "@/lib/storage";

// Профайл зургийг утас өөрөө жижгэрүүлж (≈400px) илгээнэ — том файлыг хүлээж авахгүй
const MAX_BYTES = 2 * 1024 * 1024;

/** Файлын эхний байтуудаар зургийн төрлийг таньна (Content-Type-д итгэхгүй) */
function imageType(bytes: Uint8Array): { ext: string; type: string } | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (ascii(0, 4) === "\x89PNG") return { ext: "png", type: "image/png" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { ext: "webp", type: "image/webp" };
  return null;
}

async function currentPerson() {
  const device = await getApprovedDevice();
  return device ? Personnel.findOne({ userId: device.userId }) : null;
}

/** Профайл зураг солих. Хүсэлтийн бие — зургийн файл өөрөө */
export async function POST(req: NextRequest) {
  const person = await currentPerson();
  if (!person) return NextResponse.json({ error: "Бүртгэл олдсонгүй" }, { status: 403 });
  const data = await req.arrayBuffer();
  if (!data.byteLength || data.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Зургийн хэмжээ 2MB-аас ихгүй байна" }, { status: 400 });
  }
  const kind = imageType(new Uint8Array(data, 0, Math.min(16, data.byteLength)));
  if (!kind) return NextResponse.json({ error: "Зөвхөн JPG, PNG, WEBP зураг" }, { status: 400 });

  const previous = person.photo;
  person.photo = await saveFile("avatars", kind.ext, data, kind.type);
  await person.save();
  if (previous) await deleteFile(previous).catch(() => {});
  return NextResponse.json({ photo: person.photo });
}

export async function DELETE() {
  const person = await currentPerson();
  if (!person) return NextResponse.json({ error: "Бүртгэл олдсонгүй" }, { status: 403 });
  const previous = person.photo;
  person.photo = "";
  await person.save();
  if (previous) await deleteFile(previous).catch(() => {});
  return NextResponse.json({ ok: true });
}
