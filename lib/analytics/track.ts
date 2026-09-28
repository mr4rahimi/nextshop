/**
 * فرستادن رویداد تجاری به Umami از کلاینت.
 *
 * اگر ردیاب بار نشده باشد (ادبلاکر، خاموش در پنل، هنوز در حال بار شدن)
 * بی‌صدا هیچ کاری نمی‌کند — آمار هرگز نباید جلوی خرید را بگیرد.
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۱۳.۴
 */

import type { EventName } from "@/lib/analytics/events";

type Umami = { track: (name: string, data?: Record<string, string | number>) => void };

/**
 * اسکریپت ردیاب `defer` است؛ رویدادی که در لحظه‌ی بار شدن صفحه فرستاده شود
 * (مثل `begin_checkout` روی بار کامل صفحه) ممکن است زودتر از ردیاب برسد.
 * تا ۵ ثانیه هر نیم ثانیه دوباره نگاه می‌کند و بعد بی‌صدا رها می‌کند.
 */
export function track(name: EventName, data?: Record<string, string | number>, attempt = 0) {
  if (typeof window === "undefined") return;
  try {
    const umami = (window as unknown as { umami?: Umami }).umami;
    if (umami) {
      umami.track(name, data);
      return;
    }
    if (attempt < 10) window.setTimeout(() => track(name, data, attempt + 1), 500);
  } catch {
    /* هیچ */
  }
}
