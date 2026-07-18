/**
 * توابع تاریخ شمسی — بدون وابستگی خارجی
 *
 * از `Intl.DateTimeFormat` با تقویم `persian` استفاده می‌کند که در
 * Node 18+ به‌صورت داخلی پشتیبانی می‌شود.
 *
 * قرارداد پروژه:
 *   - تاریخ تولد در دیتابیس **میلادی** ذخیره می‌شود (`ClubProfile.birthDate`)
 *   - `birthMonth` و `birthDay` مقادیر **شمسی** هستند و برای کوئری سریع
 *     کمپین تولد ایندکس شده‌اند
 *   - نمایش در UI همیشه شمسی است
 */

export interface JalaliParts {
  year: number;
  month: number; // ۱ تا ۱۲
  day: number; // ۱ تا ۳۱
}

const JALALI_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
] as const;

const formatter = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "Asia/Tehran",
});

/** میلادی → اجزای شمسی */
export function toJalali(date: Date): JalaliParts {
  const parts = formatter.formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
  };
}

/** شمسی → میلادی (جستجوی دودویی روی بازه معقول) */
export function fromJalali(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // بازه جستجو: تقریب اولیه بر اساس اختلاف ثابت ۶۲۱ سال
  let lo = Date.UTC(year + 621, 0, 1) - 200 * 86400000;
  let hi = Date.UTC(year + 622, 11, 31) + 200 * 86400000;

  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2 / 86400000) * 86400000;
    const d = new Date(mid);
    const j = toJalali(d);

    const cmp =
      j.year !== year ? j.year - year
      : j.month !== month ? j.month - month
      : j.day - day;

    if (cmp === 0) {
      // نرمال‌سازی به نیمه‌شب تهران
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }
    if (cmp < 0) lo = mid + 86400000;
    else hi = mid - 86400000;
  }

  return null;
}

/** تاریخ شمسی امروز — برای ساخت jobId کرون‌ها */
export function jalaliToday(): JalaliParts {
  return toJalali(new Date());
}

/** رشته تاریخ شمسی امروز به شکل 1405-05-02 — مناسب jobId */
export function jalaliTodayKey(): string {
  const { year, month, day } = jalaliToday();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** قالب‌بندی برای نمایش: «۲ مرداد ۱۴۰۵» */
export function formatJalali(date: Date | null | undefined): string {
  if (!date) return "—";
  const { year, month, day } = toJalali(date);
  return `${toFa(day)} ${JALALI_MONTHS[month - 1]} ${toFa(year)}`;
}

/** قالب‌بندی کوتاه: «1405/05/02» */
export function formatJalaliShort(date: Date | null | undefined): string {
  if (!date) return "—";
  const { year, month, day } = toJalali(date);
  return `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}

/** نام ماه شمسی */
export function jalaliMonthName(month: number): string {
  return JALALI_MONTHS[month - 1] ?? "";
}

/** لیست ماه‌ها برای dropdown */
export const JALALI_MONTH_OPTIONS = JALALI_MONTHS.map((title, i) => ({
  value: i + 1,
  title,
}));

/** تعداد روزهای هر ماه شمسی (اسفند در سال کبیسه ۳۰ روز) */
export function jalaliMonthLength(year: number, month: number): number {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  // اسفند: بررسی وجود روز ۳۰
  return fromJalali(year, 12, 30) ? 30 : 29;
}

/**
 * تجزیه ورودی کاربر به شکل «1370/05/02» یا «1370-5-2»
 * ارقام فارسی هم پذیرفته می‌شوند.
 */
export function parseJalaliInput(input: string): Date | null {
  if (!input) return null;

  const normalized = input
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

  const m = normalized.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (!m) return null;

  return fromJalali(Number(m[1]), Number(m[2]), Number(m[3]));
}

function toFa(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}