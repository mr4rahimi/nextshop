/**
 * ریدایرکت لینک کوتاه — docs/features/tools.md بخش ۱.
 *
 * - **302 با `no-store`، نه 301:** مرورگر 301 را کش می‌کند؛ تغییر مقصد به
 *   گوشی‌ای که یک‌بار باز کرده نمی‌رسید و کلیک‌های بعدی هم شمرده نمی‌شد.
 *   CDN جلوی سایت هم پاسخ بی‌هدر را کش می‌کند (همان درس `/tq`).
 * - **بیرون از matcher پروکسی** است: QR چاپ‌شده نباید به ریدایرکت‌های
 *   مدیریت‌شده یا کوکی منبع ورود گره بخورد. منبع ورود را صفحه‌ی مقصد با UTM
 *   خودش می‌سازد.
 * - شمارش بی‌سروصداست: خطای ثبت کلیک جلوی ریدایرکت را نمی‌گیرد.
 */

import { findLiveLink, recordShortLinkVisit } from "@/lib/tools/short-links";
import { withUtm } from "@/lib/tools/common";
import { notFoundHtml } from "@/lib/tools/public-pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  let link;
  try {
    link = await findLiveLink(decodeURIComponent(code));
  } catch (e) {
    console.error("[short-link]", e);
  }
  if (!link) return notFoundHtml("این لینک وجود ندارد یا غیرفعال شده است.");

  void recordShortLinkVisit(link.id, req);
  return new Response(null, {
    status: 302,
    headers: { location: withUtm(link.targetUrl, link), "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}

export const GET = handle;
export const HEAD = handle;
