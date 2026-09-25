/**
 * تبدیل ورودی تاریخ فرم‌های سئو، محتوا و لینک‌سازی به لحظه‌ی واقعی.
 *
 * ⚠️ تله‌ی ۳ مستندات: **`new Date("2026-09-25T09:00")` روی سرور UTC ساعت
 * ۹ به وقت گرینویچ است، نه تهران** — مهلت ۳:۳۰ جابه‌جا می‌شود. خروجی
 * `JalaliDatePicker` همیشه به وقت تهران است، پس اینجا با
 * `tehranLocalToIso` تبدیل می‌شود.
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۹
 */

import { tehranLocalToIso } from "@/lib/club/jalali";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/**
 * - `"YYYY-MM-DD"` → آخر همان روز به وقت تهران (مهلت «تا آخر روز» است)؛
 *   با `edge: "start"` اول همان روز (تاریخ بررسی و یادآوری «از آن روز» است)
 * - `"YYYY-MM-DDTHH:mm"` → همان ساعت به وقت تهران
 * - ISO کامل با منطقه‌ی زمانی → همان لحظه
 * - خالی یا نامعتبر → `null`
 */
export function parseMarketingDate(
  value: unknown,
  edge: "start" | "end" = "end",
): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const raw = String(value).trim();
  let iso = raw;
  if (DATE_ONLY.test(raw)) iso = tehranLocalToIso(`${raw}T${edge === "start" ? "00:00" : "23:59"}`);
  else if (DATE_TIME.test(raw)) iso = tehranLocalToIso(raw);
  if (!iso) return null;

  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}
