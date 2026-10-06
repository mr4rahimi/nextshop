/**
 * لینک پیامک «موجود شد» `/n/<token>` → صفحه‌ی محصول با UTM — docs/features/tools.md بخش ۷.
 *
 * آدرس فارسی محصول در پیامک بسیار بلند می‌شود؛ این لینک ۶ نویسه‌ای است و اولین
 * کلیک را ثبت می‌کند. 302 با `no-store` (همان درس لینک کوتاه `/s/`). پیش‌نمایش
 * ربات‌ها ریدایرکت می‌شود ولی کلیک حساب نمی‌شود.
 */

import { notFoundHtml } from "@/lib/tools/public-pages";
import { resolveAlertClick } from "@/lib/tools/stock-alerts";
import { isBotRequest } from "@/lib/tools/visitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  let target: string | null = null;
  try {
    target = await resolveAlertClick(decodeURIComponent(token), req.method === "GET" && !isBotRequest(req));
  } catch (e) {
    console.error("[stock-alert-link]", e);
  }
  if (!target) return notFoundHtml("این لینک وجود ندارد یا منقضی شده است.");
  return new Response(null, {
    status: 302,
    headers: { location: target, "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}

export const GET = handle;
export const HEAD = handle;
