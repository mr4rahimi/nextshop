/**
 * چیدمان لیست محصولات در کل سایت.
 *
 * این فایل عمداً «use client» ندارد تا هم از کامپوننت‌های سرور
 * (`app/(shop)/layout.tsx`) و هم از route handler ادمین قابل استفاده باشد.
 * کانتکست و کامپوننت‌های کلاینتی در
 * `components/store/product/ProductLayoutContext.tsx` هستند.
 */

export type ProductGridMode = "single" | "double";

/** پیش‌فرض `single` است تا رفتار قبلی سایت بدون تغییر بماند */
export function normalizeGridMode(v: unknown): ProductGridMode {
  return v === "double" ? "double" : "single";
}
