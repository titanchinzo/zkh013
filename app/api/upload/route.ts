import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentRole } from "@/lib/auth-role";
import type { Role } from "@/lib/roles";
import { NEWS_IMAGE_MAX_MB, NEWS_IMAGE_TYPES } from "@/lib/images";
import { TRAINING_FILE_TYPES, TRAINING_MAX_MB } from "@/lib/training";

// Файлын замын эхний хэсгээр (news/, training/) хэн юу оруулж болохыг тодорхойлно
const UPLOAD_RULES: Record<
  string,
  { roles: NonNullable<Role>[]; allowedContentTypes: string[]; maxMb: number }
> = {
  news: {
    roles: ["admin", "moderator"],
    allowedContentTypes: Object.keys(NEWS_IMAGE_TYPES),
    maxMb: NEWS_IMAGE_MAX_MB,
  },
  training: {
    roles: ["admin"],
    allowedContentTypes: Object.values(TRAINING_FILE_TYPES).map((t) => t.mime),
    maxMb: TRAINING_MAX_MB,
  },
};

// Browser нь файлыг Vercel Blob руу шууд илгээдэг (Vercel-ийн 4.5MB-ийн хязгаарт
// баригдахгүй). Энэ route зөвхөн эрхтэй хэрэглэгчид upload хийх түр token олгоно.
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const rule = UPLOAD_RULES[pathname.split("/")[0]];
        if (!rule) throw new Error("Буруу замтай файл");

        const role = await getCurrentRole();
        if (!role || !rule.roles.includes(role)) throw new Error("Файл оруулах эрхгүй байна");

        return {
          allowedContentTypes: rule.allowedContentTypes,
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
