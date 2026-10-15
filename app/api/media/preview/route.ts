import { NextRequest, NextResponse } from "next/server";
import { getCurrentRole } from "@/lib/auth-role";
import { MEDIA_URL_ERROR, parseMediaUrl } from "@/lib/media";
import { bestYouTubeThumbnail, resolveMedia } from "@/lib/media-server";

// Мэдээний формд YouTube/Facebook холбоос оруулахад урьдчилан харах мэдээлэл буцаана.
// GET /api/media/preview?url=... → { media, thumbnailUrl }
export async function GET(req: NextRequest) {
  const role = await getCurrentRole();
  if (!role) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  }

  const parsed = parseMediaUrl(req.nextUrl.searchParams.get("url"));
  if (!parsed) {
    return NextResponse.json({ error: MEDIA_URL_ERROR }, { status: 400 });
  }

  const media = await resolveMedia(parsed);
  const thumbnailUrl = media.provider === "youtube" ? await bestYouTubeThumbnail(media.videoId) : null;
  return NextResponse.json({ media, thumbnailUrl });
}
