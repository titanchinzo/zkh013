import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentRole } from "@/lib/auth-role";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

// Browser нь зургийг Vercel Blob руу шууд илгээдэг (Vercel-ийн 4.5MB-ийн хязгаарт
// баригдахгүй). Энэ route зөвхөн эрхтэй хэрэглэгчид upload хийх түр token олгоно.
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const role = await getCurrentRole();
        if (!role) throw new Error("Зураг оруулах эрхгүй байна");
        if (!pathname.startsWith("news/")) throw new Error("Буруу замтай файл");

        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
          maximumSizeInBytes: MAX_IMAGE_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Зураг оруулахад алдаа гарлаа";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
