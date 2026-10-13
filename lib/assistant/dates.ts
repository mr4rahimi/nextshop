/**
 * تاریخ برای دستیار — docs/plans/admin-assistant.md
 *
 * ⚠️ آزمون فاز ۰: مدل‌ها تاریخ عددی را اشتباه می‌خوانند (gemini «مهر» را «تیر» گفت و
 * gpt-4.1-mini مهلت فردا را «امروز کاری ندارید» خواند). پس ابزارها تاریخ را **آماده و با نام
 * ماه** می‌دهند و فاصله تا امروز را هم خودشان حساب می‌کنند.
 */
import { formatJalali, tehranLocalToIso } from "@/lib/club/jalali";

const tehranDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" });
const tehranClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hour12: false,
});
const weekday = new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", weekday: "long" });

/** لحظه‌ی شروع امروز به وقت تهران */
export function startOfTehranDay(now = new Date()): Date {
  return new Date(tehranLocalToIso(`${tehranDate.format(now)}T00:00`));
}

/** «سه‌شنبه ۲۲ مهر ۱۴۰۵، ساعت ۱۰:۲۴» — برای پرامپت */
export function tehranNowLabel(now = new Date()): string {
  return `${weekday.format(now)} ${formatJalali(now)}، ساعت ${tehranClock.format(now)}`;
}

/** تاریخ با نام ماه و فاصله تا امروز: «۲۳ مهر ۱۴۰۵ (فردا)» */
export function faDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.round((startOfTehranDay(d).getTime() - startOfTehranDay().getTime()) / 86_400_000);
  const rel =
    days === 0 ? "امروز" : days === 1 ? "فردا" : days === -1 ? "دیروز"
      : days > 0 ? `${days} روز دیگر` : `${-days} روز پیش`;
  return `${formatJalali(d)} (${rel})`;
}
