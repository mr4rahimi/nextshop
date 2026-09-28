/**
 * ردیاب هم‌دامنه‌ی Umami — `/tq/s.js` و `/tq/api/send`.
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۱۳.۳
 *
 * - **فقط همین دو مسیر عبور می‌کنند.** پروکسی عمومی یعنی API ادمین Umami از
 *   دامنه‌ی فروشگاه باز شود.
 * - **آی‌پی واقعی بازدیدکننده جلو می‌رود**، وگرنه همه «یک نفر از ۱۲۷.۰.۰.۱»اند:
 *   شهر، کشور و بازدیدکننده‌ی یکتا غلط.
 * - route handler است نه `rewrites`: `rewrites` هنگام بیلد ثابت می‌شود و
 *   خاموش‌کردن ردیاب از پنل باید بدون بیلد اثر کند.
 */

import { getAnalyticsSettings, umamiBaseUrl } from "@/lib/analytics/umami";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCRIPT_TTL_MS = 60 * 60 * 1000;
let scriptCache: { body: string; expiresAt: number } | null = null;

function notFound() {
  return new Response("Not found", { status: 404 });
}

function clientIp(req: Request) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? req.headers.get("cf-connecting-ip") ?? null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (path.join("/") !== "s.js") return notFound();

  const settings = await getAnalyticsSettings();
  if (!settings.trackingEnabled) return notFound();

  if (!scriptCache || scriptCache.expiresAt < Date.now()) {
    try {
      const res = await fetch(`${umamiBaseUrl()}/script.js`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) throw new Error(String(res.status));
      scriptCache = { body: await res.text(), expiresAt: Date.now() + SCRIPT_TTL_MS };
    } catch {
      // نسخه‌ی کهنه بهتر از هیچ؛ اگر هیچ نداریم، صفحه بی‌ردیاب می‌ماند و نمی‌شکند
      if (!scriptCache) return new Response("", { status: 503 });
    }
  }

  return new Response(scriptCache!.body, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (path.join("/") !== "api/send") return notFound();

  const settings = await getAnalyticsSettings();
  if (!settings.trackingEnabled) return new Response(null, { status: 204 });

  const body = await req.text();
  // رویداد Umami چند صد بایت است؛ سقف جلوی سوءاستفاده از مسیر را می‌گیرد
  if (body.length > 16_000) return new Response("Too large", { status: 413 });

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": req.headers.get("user-agent") ?? "",
  };
  const ip = clientIp(req);
  if (ip) headers["x-forwarded-for"] = ip;
  const lang = req.headers.get("accept-language");
  if (lang) headers["accept-language"] = lang;
  // توکن نشست که ردیاب از پاسخ قبلی نگه داشته — بدون آن هر رویداد نشست تازه است
  const cache = req.headers.get("x-umami-cache");
  if (cache) headers["x-umami-cache"] = cache;

  try {
    const res = await fetch(`${umamiBaseUrl()}/api/send`, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    return new Response(await res.text(), {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
    });
  } catch {
    // Umami خاموش است — مرورگر نباید خطای قرمز ببیند
    return new Response(null, { status: 204 });
  }
}
