/**
 * مبلغ — قالب‌بندی، ورود و «به حروف». بدون وابستگی سمت سرور؛ مرورگر هم می‌خواند.
 *
 * قرارداد (docs/plans/accounting.md تصمیم ۶): همه‌ی مبالغ **تومان** و `BigInt`
 * در دیتابیس؛ در JSON رشته (`serialize`)؛ در فرم رشته‌ی رقمی لاتین.
 */

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** ارقام فارسی/عربی → لاتین */
export function toLatinDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
}

/** عدد بدون جداکننده با ارقام فارسی — شماره‌ی سند، کد، ردیف */
export function faNum(v: number | bigint | string): string {
  return String(v).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

/** «۱٬۲۵۰٬۰۰۰» — ورودی عدد، BigInt یا رشته‌ی رقمی */
export function formatAmount(v: bigint | number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  let n: bigint;
  try {
    n = typeof v === "bigint" ? v : BigInt(typeof v === "number" ? Math.round(v) : v);
  } catch {
    return "—";
  }
  const neg = n < 0n;
  const s = (neg ? -n : n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "٬");
  return (neg ? "−" : "") + s.replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

/**
 * متن تایپ‌شده → رشته‌ی رقمی (یا خالی).
 *
 * میانبرها: «۲۵۰k» یا «۲۵۰ه» = ۲۵۰ هزار، «۲.۵m» یا «۲.۵م» = ۲٫۵ میلیون.
 * جداکننده‌ها و فاصله نادیده گرفته می‌شوند.
 */
export function parseAmountInput(raw: string): string {
  const s = toLatinDigits(raw).replace(/[,٬\s]/g, "").replace(/٫/g, ".").toLowerCase();
  const m = s.match(/^(-?\d*\.?\d*)(k|m|ه|م)?$/);
  if (!m || !m[1] || m[1] === "-" || m[1] === ".") return "";
  const mul = m[2] === "k" || m[2] === "ه" ? 1_000 : m[2] === "m" || m[2] === "م" ? 1_000_000 : 1;
  const [intPart, frac = ""] = m[1].split(".");
  if (mul === 1) return BigInt(intPart || "0").toString();
  // اعشار فقط با میانبر معنا دارد: ۲.۵m
  const scale = 10n ** BigInt(frac.length);
  const whole = BigInt((intPart || "0") + frac);
  return ((whole * BigInt(mul)) / scale).toString();
}

const ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const TEENS = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const HUNDREDS = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const SCALES = ["", "هزار", "میلیون", "میلیارد", "هزار میلیارد", "میلیون میلیارد"];

function threeDigits(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) parts.push(HUNDREDS[h]);
  if (rest >= 10 && rest < 20) parts.push(TEENS[rest - 10]);
  else {
    const t = Math.floor(rest / 10);
    const o = rest % 10;
    if (t) parts.push(TENS[t]);
    if (o) parts.push(ONES[o]);
  }
  return parts.join(" و ");
}

/** «دو میلیون و پانصد هزار» — برای زیر فیلد مبلغ و فاکتور رسمی */
export function amountToWords(v: bigint | number | string): string {
  let n: bigint;
  try {
    n = typeof v === "bigint" ? v : BigInt(v);
  } catch {
    return "";
  }
  if (n === 0n) return "صفر";
  const neg = n < 0n;
  if (neg) n = -n;
  const groups: string[] = [];
  let i = 0;
  while (n > 0n && i < SCALES.length) {
    const g = Number(n % 1000n);
    if (g) groups.unshift(threeDigits(g) + (SCALES[i] ? " " + SCALES[i] : ""));
    n /= 1000n;
    i++;
  }
  return (neg ? "منفی " : "") + groups.join(" و ");
}
