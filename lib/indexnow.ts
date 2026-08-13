import { SITE_URL } from "@/lib/seo";

/**
 * IndexNow — اعلام فوری تغییر آدرس‌ها به Bing، Yandex، Seznam و Naver.
 *
 * گوگل IndexNow را پشتیبانی نمی‌کند، ولی ایندکس Bing همان چیزی است که
 * Microsoft Copilot از آن نقل‌قول می‌کند، پس برای دیده‌شدن در پاسخ‌های AI
 * ارزش دارد.
 *
 * راه‌اندازی روی هر سایت:
 *   1) یک کلید هگزادسیمال ۸ تا ۱۲۸ کاراکتری بسازید:
 *      `openssl rand -hex 16`
 *   2) در `.env` همان سایت بگذارید:  INDEXNOW_KEY=<کلید>
 *
 * بدون این متغیر، همه‌ی توابع بی‌صدا کاری نمی‌کنند — هیچ سایتی به‌خاطر
 * نداشتن کلید خطا نمی‌دهد.
 */

const ENDPOINT = "https://api.indexnow.org/indexnow";

/** مسیر فایل کلید. عمداً بیرون از `/api/` است چون robots.txt آن را می‌بندد. */
export const INDEXNOW_KEY_PATH = "/indexnow-key.txt";

export function getIndexNowKey(): string | null {
  const key = process.env.INDEXNOW_KEY?.trim();
  if (!key) return null;
  // استاندارد: فقط هگز، بین ۸ تا ۱۲۸ کاراکتر
  if (!/^[a-f0-9]{8,128}$/i.test(key)) return null;
  return key;
}

/**
 * آدرس‌ها را به IndexNow اعلام می‌کند.
 *
 * هرگز throw نمی‌کند و هرگز پاسخ ادمین را بلاک نمی‌کند — اگر سرویس پایین بود
 * یا شبکه قطع بود، فقط در لاگ می‌نویسد. ذخیره‌ی محصول نباید به‌خاطر
 * IndexNow شکست بخورد.
 */
export async function submitToIndexNow(urls: string[]): Promise<void> {
  const key = getIndexNowKey();
  if (!key) return;

  const unique = [...new Set(urls.filter(Boolean))];
  if (unique.length === 0) return;

  let host: string;
  try {
    host = new URL(SITE_URL).host;
  } catch {
    return; // SITE_URL تنظیم نشده
  }

  // در لوکال چیزی برای اعلام نیست
  if (/^(localhost|127\.|0\.0\.0\.0)/.test(host)) return;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `${SITE_URL}${INDEXNOW_KEY_PATH}`,
        urlList: unique.slice(0, 10000), // سقف هر درخواست طبق استاندارد
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.warn(`[indexnow] ${res.status} برای ${unique.length} آدرس`);
    }
  } catch (err) {
    console.warn("[indexnow] ارسال ناموفق:", err);
  }
}

/** میان‌بر برای یک صفحه‌ی محصول */
export function productUrl(slug: string) {
  return `${SITE_URL}/products/${encodeURIComponent(slug)}`;
}
