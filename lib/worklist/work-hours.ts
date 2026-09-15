/**
 * ساعت کاری هفتگی — هر روز هفته جدا، قابل ویرایش از تنظیمات کارتابل.
 *
 * این فایل عمداً Prisma ایمپورت نمی‌کند تا فرم تنظیمات در مرورگر هم از همان
 * اعتبارسنجی و پیش‌فرض استفاده کند. خواندن از دیتابیس در `settings.ts` است.
 *
 * روزها مطابق تقویم ایران شماره می‌خورند: شنبه = ۰ … جمعه = ۶.
 */

export interface DayHours {
  /** شنبه = ۰ */
  day: number;
  open: boolean;
  /** «09:00» */
  start: string;
  /** «18:00» */
  end: string;
}

export const WEEKDAY_LABELS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

/**
 * پیش‌فرض وقتی مدیر هنوز چیزی ذخیره نکرده — ساعت کاری مهام‌پرینت:
 * شنبه تا چهارشنبه ۹ تا ۱۸، پنجشنبه ۹ تا ۱۴، جمعه تعطیل.
 */
export const DEFAULT_WORK_HOURS: DayHours[] = [
  { day: 0, open: true, start: "09:00", end: "18:00" },
  { day: 1, open: true, start: "09:00", end: "18:00" },
  { day: 2, open: true, start: "09:00", end: "18:00" },
  { day: 3, open: true, start: "09:00", end: "18:00" },
  { day: 4, open: true, start: "09:00", end: "18:00" },
  { day: 5, open: true, start: "09:00", end: "14:00" },
  { day: 6, open: false, start: "09:00", end: "18:00" },
];

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function timeToMinutes(t: string): number {
  const m = TIME_RE.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

/**
 * هر ورودیِ ذخیره‌شده را به هفت روزِ کامل تبدیل می‌کند.
 *
 * آرایه‌ی خالی یا خراب پیش‌فرض را برمی‌گرداند؛ روزِ جاافتاده از پیش‌فرض پر
 * می‌شود. خواندن هیچ‌وقت خطا نمی‌دهد — تنظیمات خراب نباید زمان‌بند را بخواباند.
 */
export function normalizeWorkHours(raw: unknown): DayHours[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_WORK_HOURS.map((d) => ({ ...d }));
  return DEFAULT_WORK_HOURS.map((def) => {
    const hit = raw.find(
      (r): r is Record<string, unknown> =>
        !!r && typeof r === "object" && (r as Record<string, unknown>).day === def.day,
    );
    if (!hit) return { ...def };
    const start = typeof hit.start === "string" && TIME_RE.test(hit.start) ? hit.start : def.start;
    const end = typeof hit.end === "string" && TIME_RE.test(hit.end) ? hit.end : def.end;
    return { day: def.day, open: hit.open === true, start, end };
  });
}

/** اعتبارسنجی ورودی فرم — برخلاف `normalizeWorkHours` خطا را برمی‌گرداند */
export function validateWorkHours(raw: unknown): { hours: DayHours[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length !== 7) return { error: "ساعت کاری باید برای هر هفت روز باشد" };
  const hours: DayHours[] = [];
  for (let day = 0; day < 7; day++) {
    const r = raw.find((x) => x && typeof x === "object" && x.day === day) as
      | Record<string, unknown>
      | undefined;
    if (!r) return { error: `ساعت کاری ${WEEKDAY_LABELS[day]} نیامده است` };
    const open = r.open === true;
    const start = typeof r.start === "string" ? r.start : "";
    const end = typeof r.end === "string" ? r.end : "";
    if (open) {
      if (!TIME_RE.test(start) || !TIME_RE.test(end)) {
        return { error: `ساعت ${WEEKDAY_LABELS[day]} نامعتبر است (مثل ۰۹:۰۰)` };
      }
      if (timeToMinutes(end) <= timeToMinutes(start)) {
        return { error: `پایان کار ${WEEKDAY_LABELS[day]} باید بعد از شروعش باشد` };
      }
    }
    hours.push({
      day,
      open,
      start: TIME_RE.test(start) ? start : "09:00",
      end: TIME_RE.test(end) ? end : "18:00",
    });
  }
  if (!hours.some((h) => h.open)) return { error: "دست‌کم یک روز باید کاری باشد" };
  return { hours };
}

/** دقیقه‌ی موظفِ یک روز هفته — روز تعطیل صفر */
export function expectedMinutes(hours: DayHours[], weekday: number): number {
  const h = hours.find((x) => x.day === weekday);
  if (!h || !h.open) return 0;
  return Math.max(0, timeToMinutes(h.end) - timeToMinutes(h.start));
}

export function isWorkday(hours: DayHours[], weekday: number): boolean {
  return hours.find((x) => x.day === weekday)?.open === true;
}

export const WORK_MODE_LABELS: Record<string, string> = {
  ONSITE: "حضوری",
  REMOTE: "دورکار",
  HYBRID: "ترکیبی",
};
