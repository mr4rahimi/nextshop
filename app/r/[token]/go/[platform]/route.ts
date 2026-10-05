/**
 * کلیک روی دکمه‌ی یک سکو — شمارش و ریدایرکت 302 بدون کش.
 * `site?p=<slug>` به صفحه‌ی همان محصول و زبانه‌ی نظرات می‌رود.
 * docs/features/tools.md بخش ۴
 */

import { canonicalUrl } from "@/lib/seo";
import { notFoundHtml } from "@/lib/tools/public-pages";
import { resolvePlatformClick } from "@/lib/tools/reviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ token: string; platform: string }> }) {
  const { token, platform } = await ctx.params;
  const p = new URL(req.url).searchParams.get("p");
  let target: string | null = null;
  try {
    target = await resolvePlatformClick(decodeURIComponent(token), platform, p);
  } catch (e) {
    console.error("[review-go]", e);
  }
  if (!target) return notFoundHtml("این لینک معتبر نیست.");
  // ⚠️ نه `req.url`: پشت nginx آن `localhost:PORT` است (درس ۱ راهنمای پروژه)
  const location = target.startsWith("/") ? canonicalUrl(target) : target;
  return new Response(null, { status: 302, headers: { location, "cache-control": "no-store", "x-robots-tag": "noindex" } });
}
