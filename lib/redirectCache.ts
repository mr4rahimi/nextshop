/**
 * کش قواعد ریدایرکت برای middleware.
 *
 * چرا کش لازم است: middleware روی **هر** درخواست صفحه اجرا می‌شود. اگر هر بار
 * به دیتابیس بزنیم، روی سرورهایی که TTFB‌شان از قبل بالاست یک کوئری اضافه به
 * مسیر داغ اضافه کرده‌ایم. با کش، جستجو یک `Map.get()` در حافظه است.
 *
 * چرا از طریق fetch و نه مستقیم Prisma: middleware ممکن است روی edge runtime
 * اجرا شود که Prisma در آن کار نمی‌کند. یک route handler معمولی (Node) قواعد را
 * می‌خواند و middleware همان را می‌گیرد. هزینه‌اش حداکثر یک fetch در هر
 * `TTL_MS` است، نه یک fetch در هر درخواست.
 */

import type { RedirectRule } from "./redirects";

const TTL_MS = 60_000;

let rules: RedirectRule[] = [];
let loadedAt = 0;
let inflight: Promise<RedirectRule[]> | null = null;

/** توکن مشترک تا این مسیر داخلی از بیرون قابل صدا زدن نباشد. */
export const INTERNAL_HEADER = "x-redirect-cache-token";

export function internalToken(): string {
  return process.env.REDIRECT_CACHE_TOKEN || "";
}

/**
 * پایه‌ی آدرس برای فراخوانی مسیر داخلی.
 *
 * عمداً از `origin` درخواست کاربر استفاده **نمی‌کنیم**. اگر می‌کردیم، اپ برای
 * خواندن قواعد خودش به آدرس عمومی خودش درخواست می‌داد؛ یعنی ترافیک باید از
 * سرور بیرون می‌رفت، از DNS و CDN رد می‌شد و برمی‌گشت. روی سایت دمو همین
 * باعث شد ریدایرکت‌ها از آدرس عمومی کار نکنند در حالی که روی پورت مستقیم اپ
 * درست کار می‌کردند.
 *
 * حالا همیشه از حلقه‌ی محلی خوانده می‌شود. `PORT` را pm2/Next ست می‌کند؛
 * اگر نبود ۳۰۰۰ پیش‌فرض است. در صورت نیاز با `INTERNAL_BASE_URL` قابل
 * بازنویسی است.
 */
export function internalBase(): string {
  const explicit = process.env.INTERNAL_BASE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const port = process.env.PORT || "3000";
  return `http://127.0.0.1:${port}`;
}

/**
 * قواعد فعال را برمی‌گرداند. اگر کش تازه باشد بدون I/O جواب می‌دهد.
 *
 * اگر واکشی شکست بخورد، **قواعد قدیمی نگه داشته می‌شوند** و خطا بالا نمی‌رود:
 * از دست رفتن موقت ریدایرکت‌ها بهتر از ۵۰۰ شدن کل سایت است.
 */
export async function getRules(): Promise<RedirectRule[]> {
  const fresh = Date.now() - loadedAt < TTL_MS;
  if (fresh && rules.length >= 0 && loadedAt > 0) return rules;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch(`${internalBase()}/api/internal/redirects`, {
        headers: { [INTERNAL_HEADER]: internalToken() },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { rules: RedirectRule[] };
      rules = Array.isArray(data.rules) ? data.rules : [];
      loadedAt = Date.now();
    } catch {
      // کش قبلی حفظ می‌شود؛ دفعه‌ی بعد دوباره تلاش می‌کنیم
      loadedAt = Date.now() - TTL_MS + 5_000; // ۵ ثانیه دیگر retry
    } finally {
      inflight = null;
    }
    return rules;
  })();

  return inflight;
}

/**
 * عمداً تابع invalidate ندارد.
 *
 * middleware و route handlerها نمونه‌ی ماژول جداگانه دارند (و در حالت
 * چندپروسه‌ای pm2 حتی حافظه‌ی جداگانه)، پس صدا زدن یک `invalidate()` از داخل
 * API روی کش middleware اثری نمی‌گذاشت — تابعی می‌شد که ظاهراً کار می‌کند و
 * در عمل نه. به‌جایش TTL کوتاه است: هر تغییری در ادمین حداکثر تا
 * ۶۰ ثانیه اعمال می‌شود. این عدد در پیام ادمین هم به کاربر گفته می‌شود.
 */
export const TTL_SECONDS = TTL_MS / 1000;
