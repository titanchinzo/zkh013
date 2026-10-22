import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import TrainingMaterial from "@/lib/models/TrainingMaterial";
import { getCurrentRole } from "@/lib/auth-role";
import { isStoredFileUrl } from "@/lib/images";
import { deleteFile } from "@/lib/storage";
import { parseTrainingInput } from "@/lib/training";
import { warmMgl } from "@/lib/mgl/convert";

type Params = { params: Promise<{ id: string }> };

// Хуучирсан файлыг (сервер эсвэл Blob) устгана. Амжилтгүй болсон ч үндсэн үйлдлийг зогсоохгүй.
async function deleteStoredFile(url: string | undefined) {
  if (!url || !isStoredFileUrl(url)) return;
  try {
    await deleteFile(url);
  } catch (err) {
    console.error("[training] файл устгаж чадсангүй:", url, err);
  }
}

async function findMaterial(id: string) {
  await connectToDatabase();
  try {
    return await TrainingMaterial.findById(id);
  } catch {
    return null; // буруу ObjectId
  }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const material = await findMaterial((await params).id);
  if (!material) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  // createdBy (оруулсан ажилтны Clerk ID)-г нийтэд харуулахгүй
  const data = material.toObject();
  delete data.createdBy;
  return NextResponse.json({ material: data });
}

export async function PUT(req: NextRequest, { params }: Params) {
  if ((await getCurrentRole()) !== "admin") {
    return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  }

  const parsed = parseTrainingInput(await req.json().catch(() => null));
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const material = await findMaterial((await params).id);
  if (!material) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });

  const previousUrl = material.url;
  material.set(parsed.data);
  await material.save();
  if (previousUrl !== material.url) await deleteStoredFile(previousUrl);
  // Монгол бичгийн хувилбарыг хариу илгээсний дараа бэлдэнэ
  warmMgl([material.title, material.description ?? ""]);

  return NextResponse.json({ material });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  if ((await getCurrentRole()) !== "admin") {
    return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  }

  const material = await findMaterial((await params).id);
  if (!material) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });

  await material.deleteOne();
  await deleteStoredFile(material.url);
  return NextResponse.json({ ok: true });
}
