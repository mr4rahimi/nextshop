/**
 * درگاه حسابداری — قراردادی که مصرف‌کننده‌ی رویدادها پیاده می‌کند.
 *
 * فقط حسابداری داخلی مصرف‌کننده دارد. حالت حسابان رویدادها را مصرف نمی‌کند:
 * اتصال حسابان همان مسیر قبلی یکپارچه‌سازی است و وابستگی‌ای به این لایه ندارد
 * (docs/plans/accounting.md تصمیم ۱۴).
 */

import type { AccEvent } from "@prisma/client";

export type ApplyResult =
  /** کامل ثبت شد؛ `ref` شناسه‌ی سند یا فاکتور ساخته‌شده */
  | { kind: "done"; ref?: string }
  /** چیزی برای ثبت نماند */
  | { kind: "skipped"; reason: string }
  /** داده ناقص است — بعد از رفع مشکل دوباره سنجیده می‌شود */
  | { kind: "blocked"; reason: string }
  /** خطای موقت — با تأخیر دوباره تلاش می‌شود */
  | { kind: "retry"; error: string };

export interface AccountingProvider {
  apply(event: AccEvent): Promise<ApplyResult>;
}
