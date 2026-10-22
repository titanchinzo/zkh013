import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentRole } from "@/lib/auth-role";
import { UPLOAD_KINDS, uploadKindOfFolder } from "@/lib/uploads";

// Vercel дээр (UPLOAD_DIR-гүй үед): browser нь файлыг Vercel Blob руу шууд илгээдэг (Vercel-ийн 4.5MB-ийн
// хязгаарт баригдахгүй). Энэ route зөвхөн эрхтэй хэрэглэгчид upload хийх түр token олгоно. Файлын замын
// эхний хэсгээр (news/, videos/, training/) хэн юу оруулж болохыг lib/uploads.ts-ээс тодорхойлно.
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const kind = uploadKindOfFolder(pathname.split("/")[0]);
        if (!kind) throw new Error("Буруу замтай файл");
        const rule = UPLOAD_KINDS[kind];

        const role = await getCurrentRole();
        if (!role || !rule.roles.includes(role)) throw new Error("Файл оруулах эрхгүй байна");

        return {
          allowedContentTypes: Object.keys(rule.types),
          maximumSizeInBytes: rule.maxMb * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Файл оруулахад алдаа гарлаа";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
