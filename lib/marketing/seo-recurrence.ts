/**
 * محاسبه‌ی موعد بعدی کار دوره‌ای سئو.
 *
 * **توابع خالص‌اند: تاریخ می‌گیرند و تاریخ می‌دهند و به prisma دست نمی‌زنند.**
 * دلیلش این است که هم زمان‌بند و هم پیش‌نمایشِ فرم («اجرای بعدی: ...») به
 * همین محاسبه نیاز دارند و نباید دو منطق ساخته شود.
 *
 * ⚠️ **«هر ماه» یعنی ماه شمسی، نه میلادی.** واحد گزارش و برنامه‌ریزی تیم
 * شمسی است؛ کاری که «اول هر ماه» تنظیم شده باید اول فروردین و اول اردیبهشت
 * بیاید، نه اول ژانویه.
 *
 * ⚠️ **روزِ ته‌ماه پایین می‌آید و دیگر بالا نمی‌رود.** کاری که روز ۳۱ فروردین
 * تنظیم شده، در مهرِ ۳۰ روزه روز ۳۰ می‌آید و **در آبان دوباره ۳۱ نمی‌شود** —
 * چون مبنای هر اجرا تاریخ اجرای قبلی است، نه تاریخ اولین اجرا. این عمدی و
 * ساده است: نگه‌داشتن «روز اصلی» یعنی یک ستون بیشتر و یک منبع حقیقت دوم.
 *
 * ⚠️ همه‌ی محاسبه‌ها با **ساعت تهران** است، چون سرور روی UTC است. ساعتِ
 * دیواریِ اجرا حفظ می‌شود: کاری که ۹ صبح تنظیم شده، ماه بعد هم ۹ صبح است.
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۵.۶
 */

import {
  toJalali,
  fromJalali,
  jalaliMonthLength,
  isoToTehranLocal,
  tehranLocalToIso,
} from "@/lib/club/jalali";
import type { SeoRecurrenceUnit } from "@prisma/client";

/** حداکثر پرشِ مجاز هنگام رساندن موعد به آینده — محافظ حلقه‌ی بی‌پایان */
const MAX_ADVANCE_STEPS = 500;

/** «HH:mm» ساعتِ تهرانِ یک لحظه */
function tehranTimeOf(date: Date): string {
  const local = isoToTehranLocal(date.toISOString());
  return local ? local.slice(11, 16) : "00:00";
}

/**
 * افزودن ماه شمسی، با **بریدن روز به اندازه‌ی ماه مقصد**.
 *
 * ۳۱ فروردین + ۶ ماه = ۳۰ مهر (نه ۳۱ مهر که وجود ندارد).
 */
export function addJalaliMonths(date: Date, months: number): Date {
  const { year, month, day } = toJalali(date);
  const time = tehranTimeOf(date);

  const zeroBased = month - 1 + months;
  const targetYear = year + Math.floor(zeroBased / 12);
  // `%` در جاوااسکریپت برای عدد منفی منفی می‌دهد؛ این نرمال‌سازی لازم است
  const targetMonth = ((zeroBased % 12) + 12) % 12 + 1;
  const targetDay = Math.min(day, jalaliMonthLength(targetYear, targetMonth));

  const g = fromJalali(targetYear, targetMonth, targetDay);
  if (!g) return new Date(date.getTime()); // نباید بیفتد؛ تاریخ را دست‌نخورده برگردان

  // `fromJalali` نیمه‌شبِ همان روز را می‌دهد؛ ساعت دیواری را دوباره می‌چسبانیم
  const ymd = g.toISOString().slice(0, 10);
  const iso = tehranLocalToIso(`${ymd}T${time}`);
  return iso ? new Date(iso) : g;
}

/** یک گام جلو، بر اساس واحد و فاصله‌ی الگو */
export function nextRunAfter(
  from: Date,
  unit: SeoRecurrenceUnit,
  intervalCount: number,
): Date {
  const step = Math.max(1, Math.trunc(intervalCount));
  if (unit === "WEEK") {
    // هفته عمداً با میلی‌ثانیه است نه تقویم: هفت روز، هفت روز است و
    // تبدیل رفت‌وبرگشتِ تقویمی فقط جای خطا باز می‌کند.
    return new Date(from.getTime() + step * 7 * 86400000);
  }
  return addJalaliMonths(from, step);
}

export interface AdvanceResult {
  /** موعد بعدی، همیشه در آینده */
  nextRunAt: Date;
  /** چند نوبت رد شد — بیشتر از صفر یعنی پنل مدتی باز نشده بود */
  skipped: number;
}

/**
 * موعد را تا اولین تاریخِ آینده جلو می‌برد.
 *
 * ⚠️ **عقب‌افتادگی انباشته نمی‌شود.** اگر پنل سه ماه باز نشده باشد، فقط
 * **یک** کار ساخته می‌شود (کارِ همین نوبت) و موعد به اولین تاریخ آینده
 * می‌پرد. سه «بررسی ماهانه»ی هم‌زمان فقط فهرست را شلوغ می‌کنند و هیچ‌کدام
 * انجام نمی‌شوند.
 *
 * `skipped` برای ثبت در رویداد است تا معلوم بماند چند نوبت از دست رفت.
 */
export function advanceToFuture(
  nextRunAt: Date,
  unit: SeoRecurrenceUnit,
  intervalCount: number,
  now: Date = new Date(),
): AdvanceResult {
  let cursor = nextRunAt;
  let skipped = 0;

  while (cursor.getTime() <= now.getTime() && skipped < MAX_ADVANCE_STEPS) {
    const moved = nextRunAfter(cursor, unit, intervalCount);
    // محافظ: اگر محاسبه جلو نرفت، حلقه را نشکسته رها نکن
    if (moved.getTime() <= cursor.getTime()) {
      return { nextRunAt: new Date(now.getTime() + 86400000), skipped };
    }
    cursor = moved;
    skipped++;
  }

  // `skipped` یعنی «چند نوبت رد شد»؛ نوبتِ همین حالا که کارش ساخته می‌شود
  // جزو رد‌شده‌ها نیست.
  return { nextRunAt: cursor, skipped: Math.max(0, skipped - 1) };
}

/** مهلت کار ساخته‌شده از الگو — `dueOffsetDays` روز بعد از ساخت */
export function dueFromOffset(base: Date, days: number | null): Date | null {
  if (days === null || days === undefined) return null;
  return new Date(base.getTime() + days * 86400000);
}
