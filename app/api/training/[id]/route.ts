import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { connectToDatabase } from "@/lib/mongodb";
import TrainingMaterial from "@/lib/models/TrainingMaterial";
import { getCurrentRole } from "@/lib/auth-role";
import { isVercelBlobUrl } from "@/lib/images";
import { parseTrainingInput } from "@/lib/training";

type Params = { params: Promise<{ id: string }> };

// Хуучирсан файлыг Blob-оос устгана. Амжилтгүй болсон ч үндсэн үйлдлийг зогсоохгүй.
async function deleteBlobFile(url: string | undefined) {
  if (!url || !isVercelBlobUrl(url)) return;
  try {
    await del(url);
  } catch (err) {
    console.error("[training] Blob файл устгаж чадсангүй:", url, err);
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
  return NextResponse.json({ material });
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
  if (previousUrl !== material.url) await deleteBlobFile(previousUrl);

  return NextResponse.json({ material });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  if ((await getCurrentRole()) !== "admin") {
    return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  }

  const material = await findMaterial((await params).id);
  if (!material) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });

  await material.deleteOne();
  await deleteBlobFile(material.url);
  return NextResponse.json({ ok: true });
}
