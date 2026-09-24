/**
 * تاریخ مالی — همیشه «روز تهران» (UTC نیمه‌شبِ همان روز شمسی)، همان قرارداد
 * `dayKeyOf` کارتابل و `fromJalali`. ستون‌های `@db.Date` همین مقدار را می‌گیرند.
 *
 * ⚠️ `new Date()` سرور UTC است؛ «امروز» فقط از `todayKey()` (تله‌ی ۱۰).
 */

import { fromJalali, toJalali } from "@/lib/club/jalali";

const DAY_MS = 86_400_000;
const TEHRAN_OFFSET_MS = 3.5 * 3_600_000;

/** روز تهرانِ یک لحظه */
export function dayKey(at: Date): Date {
  return new Date(Math.floor((at.getTime() + TEHRAN_OFFSET_MS) / DAY_MS) * DAY_MS);
}

export function todayKey(): Date {
  return dayKey(new Date());
}

/**
 * ورودی تاریخ فرم («YYYY-MM-DD» میلادی از `JalaliDatePicker`، یا ISO) → روز.
 * رشته‌ی تاریخ خالص همان روز است؛ ISO با ساعت به روز تهران برده می‌شود.
 */
export function parseDay(input: unknown): Date | null {
  if (typeof input !== "string" || !input) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const d = new Date(`${input}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : dayKey(d);
}

/** «YYYY-MM-DD» برای `JalaliDatePicker` */
export function dayValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** سال شمسیِ یک روز → بازه‌ی فروردین تا اسفند */
export function jalaliYearBounds(jy: number): { start: Date; end: Date } {
  const start = fromJalali(jy, 1, 1)!;
  const next = fromJalali(jy + 1, 1, 1)!;
  return { start, end: new Date(next.getTime() - DAY_MS) };
}

export function jalaliYearOf(d: Date): number {
  return toJalali(d).year;
}

/** ماه شمسیِ یک روز → اول تا آخر همان ماه */
export function jalaliMonthBounds(d: Date): { start: Date; end: Date } {
  const j = toJalali(d);
  const start = fromJalali(j.year, j.month, 1)!;
  const next = j.month === 12 ? fromJalali(j.year + 1, 1, 1)! : fromJalali(j.year, j.month + 1, 1)!;
  return { start, end: new Date(next.getTime() - DAY_MS) };
}

/** بازه‌ی هم‌طولِ درست قبل از `[from, to]` — «مقایسه با دوره‌ی قبل» */
export function previousRange(from: Date, to: Date): { from: Date; to: Date } {
  const len = to.getTime() - from.getTime() + DAY_MS;
  return { from: new Date(from.getTime() - len), to: new Date(from.getTime() - DAY_MS) };
}

/** همه‌ی روزهای بازه، شامل دو سر */
export function daysBetween(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  for (let t = from.getTime(); t <= to.getTime(); t += DAY_MS) out.push(new Date(t));
  return out;
}
