import { getIndexNowKey } from "@/lib/indexnow";

// SITE_URL و کلید per-deployment هستند، پس نباید در build ثابت شوند.
export const dynamic = "force-dynamic";

/**
 * فایل تأیید مالکیت IndexNow.
 *
 * موتور جستجو این آدرس را می‌خواند و محتوایش باید دقیقاً همان کلیدی باشد که
 * در درخواست فرستاده‌ایم. اگر `INDEXNOW_KEY` تنظیم نشده باشد ۴۰۴ می‌دهد.
 */
export function GET() {
  const key = getIndexNowKey();
  if (!key) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(key, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
