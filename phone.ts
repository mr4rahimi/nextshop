/**
 * نرمال‌سازی شماره موبایل ایرانی
 *
 * فرمت استاندارد پروژه: `09xxxxxxxxx` (۱۱ رقم)
 * این فرمت با داده‌های موجود در جدول User سازگار است و نباید تغییر کند.
 *
 * ورودی‌های پشتیبانی‌شده:
 *   09123456789 · 9123456789 · +989123456789 · 00989123456789
 *   989123456789 · ۰۹۱۲۳۴۵۶۷۸۹ (ارقام فارسی) · ٠٩١٢٣٤٥٦٧٨٩ (ارقام عربی)
 *   به همراه فاصله، خط تیره، پرانتز و نیم‌فاصله
 */

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** تبدیل ارقام فارسی و عربی به انگلیسی */
export function toEnglishDigits(input: string): string {
  let out = "";
  for (const ch of input) {
    const fa = PERSIAN_DIGITS.indexOf(ch);
    if (fa > -1) { out += String(fa); continue; }
    const ar = ARABIC_DIGITS.indexOf(ch);
    if (ar > -1) { out += String(ar); continue; }
    out += ch;
  }
  return out;
}

/** تبدیل ارقام انگلیسی به فارسی — برای نمایش در UI */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

/**
 * نرمال‌سازی به فرمت `09xxxxxxxxx`
 * در صورت نامعتبر بودن، `null` برمی‌گرداند.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;

  // ارقام فارسی/عربی → انگلیسی، سپس حذف هر چیزی جز رقم و علامت +
  let s = toEnglishDigits(String(input)).replace(/[^\d+]/g, "");

  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("0098")) s = s.slice(4);
  else if (s.startsWith("98")) s = s.slice(2);
  else if (s.startsWith("0")) s = s.slice(1);

  // در این مرحله باید دقیقاً ۱۰ رقم با شروع 9 باشد
  if (!/^9\d{9}$/.test(s)) return null;

  return "0" + s;
}

/** آیا شماره یک موبایل ایرانی معتبر است؟ */
export function isValidIranMobile(input: string | null | undefined): boolean {
  return normalizePhone(input) !== null;
}

/**
 * نسخه بین‌المللی برای ارسال به سرویس‌هایی که فرمت 98 می‌خواهند
 * 09123456789 → 989123456789
 */
export function toInternational(input: string | null | undefined): string | null {
  const n = normalizePhone(input);
  return n ? "98" + n.slice(1) : null;
}

/** پیش‌شماره اپراتور — 912 ، 935 و ... (برای گزارش و بخش‌بندی) */
export function operatorPrefix(input: string | null | undefined): string | null {
  const n = normalizePhone(input);
  return n ? n.slice(1, 4) : null;
}

/**
 * ماسک کردن برای نمایش عمومی و لاگ
 * 09123456789 → 0912***6789
 */
export function maskPhone(input: string | null | undefined): string {
  const n = normalizePhone(input);
  if (!n) return "—";
  return `${n.slice(0, 4)}***${n.slice(7)}`;
}

/**
 * نرمال‌سازی و حذف تکراری‌ها برای یک لیست
 * شماره‌های نامعتبر کنار گذاشته و جداگانه برگردانده می‌شوند.
 */
export function normalizePhoneList(inputs: (string | null | undefined)[]): {
  valid: string[];
  invalid: string[];
} {
  const seen = new Set<string>();
  const invalid: string[] = [];

  for (const raw of inputs) {
    const n = normalizePhone(raw);
    if (n) seen.add(n);
    else if (raw) invalid.push(String(raw));
  }

  return { valid: [...seen], invalid };
}
