/**
 * یکسان‌سازی نوشتار برای جستجوی چت فروشگاه — docs/plans/storefront-chat.md
 *
 * مشتری مدل را هر جور بنویسد («M236d»، «m 236 d»، «M236-D»، «ام۲۳۶») و عنوان محصول
 * هر جور ثبت شده باشد، شکل فشرده‌ی هر دو یکی است: حروف کوچک، رقم لاتین، ی/ک فارسی،
 * بی‌فاصله و بی‌نشانه. همین تابع در SQL هم تکرار شده (`COMPACT_SQL` در search.ts).
 *
 * بدون Prisma تا اسکریپت آزمون بی‌دیتابیس هم اجرا شود.
 */

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function normalizeText(input: string): string {
  let s = input.toLowerCase();
  s = s.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)));
  s = s.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
  s = s.replace(/ي/g, "ی").replace(/ى/g, "ی").replace(/ك/g, "ک").replace(/ة/g, "ه").replace(/[أإآ]/g, "ا");
  s = s.replace(/[ً-ْـ]/g, ""); // اعراب و کشیده
  return s;
}

/** شکل فشرده: فقط حرف و رقم — برای مقایسه‌ی زیررشته */
export function compact(input: string): string {
  return normalizeText(input).replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * واژه‌هایی که در جمله‌ی مشتری هستند ولی در عنوان محصول نه. اگر در جستجو بمانند،
 * «قیمت پرینتر ۳۰۱۰ چنده» هیچ محصولی نمی‌آورد چون «قیمت» و «چنده» در عنوان نیست.
 */
const STOPWORDS = new Set(
  [
    "قیمت", "قیمتش", "چند", "چنده", "چقدر", "چقد", "دارید", "دارین", "داری", "دارین؟", "هست", "هستش", "است",
    "میخوام", "میخواستم", "میخام", "می‌خوام", "می‌خواستم", "خواستم", "لطفا", "لطفاً", "سلام", "ممنون", "مرسی",
    "خرید", "بخرم", "برای", "واسه", "با", "و", "یا", "یه", "یک", "از", "به", "که", "را", "رو", "در", "تو", "این", "اون",
    "مدل", "استعلام", "چیست", "چیه", "میخوره", "می‌خوره", "موجود", "موجوده", "موجودی", "دارد", "ندارید", "کالا", "محصول", "جنس", "بفرمایید", "راهنمایی", "مناسب",
    "خوب", "بهترین", "ارزان", "ارزون", "ارزانترین", "ارزونترین", "ارزان‌ترین", "گران", "گرون", "نو", "اصل", "اورجینال",
  ].map(normalizeText),
);

/** شکل فارسی واژه‌هایی که در عنوان و مشخصات معمولاً لاتین نوشته می‌شوند */
const SYNONYMS: Record<string, string> = {
  وایفای: "wifi",
  بلوتوث: "bluetooth",
  یواسبی: "usb",
};

/**
 * کلیدواژه‌های جستجو. «۳۰۰ در ۱۰۰» و «۳۰۰×۱۰۰» هر دو دو عدد می‌شوند؛ واژه‌ی تک‌حرفی
 * حذف می‌شود مگر رقم باشد («لیبل ۵۰ در ۳» عدد ۳ را لازم دارد).
 */
export function searchTokens(query: string): string[] {
  const words = normalizeText(query)
    // «kc-2089استعلام» و «hpقیمت»: مرز حروف لاتین/رقم با فارسی یک فاصله است
    .replace(/([a-z0-9])(?=[\u0600-\u06FF])|([\u0600-\u06FF])(?=[a-z0-9])/g, "$1$2 ")
    .replace(/(^|\s)اچ[\s\u200c]*پی(?=\s|$)/g, "$1hp")
    .replace(/وای[\s\u200c-]*فای/g, "وایفای")
    .replace(/(^|\s)wi[\s-]*fi(?=\s|$)/g, "$1wifi")
    .replace(/[×x*]/g, (m, i, s) => (/\d/.test(s[i - 1] ?? "") && /\d/.test(s[i + 1] ?? "") ? " " : m))
    .split(/[\s,،؛;:!?؟()\[\]{}"'«»/\\|]+/)
    .map((w) => w.replace(/^[-_.]+|[-_.]+$/g, ""))
    .filter(Boolean);
  const out: string[] = [];
  for (const w of words) {
    if (STOPWORDS.has(w)) continue;
    const c = compact(w);
    if (!c) continue;
    if (c.length < 2 && !/^\d$/.test(c)) continue;
    const word = SYNONYMS[c] ?? c;
    if (!out.includes(word)) out.push(word);
  }
  // کد مدل (هر چه رقم دارد) مهم‌ترین کلیدواژه است و نباید در برش بیفتد
  return [...out.filter((t) => /\d/.test(t)), ...out.filter((t) => !/\d/.test(t))].slice(0, 8);
}

/**
 * شکل‌های قابل‌قبول یک کلیدواژه؛ هر شکل فهرستی از تکه‌هاست که همه باید در متن باشند.
 * «hp1102w» در عنوان «HP LaserJet Pro P1102w» به هم چسبیده نیست، پس «hp» + «1102w» هم پذیرفته است.
 * پیشوند تک‌حرفی («m236d») جدا نمی‌شود چون «m» تقریباً در هر عنوانی هست.
 */
export function tokenForms(token: string): string[][] {
  const forms = [[token]];
  const m = token.match(/^([a-z]{2,})(\d[a-z0-9]*)$/);
  if (m) forms.push([m[1], m[2]]);
  return forms;
}

/** متن ساده از HTML صفحه‌ها — برای خواندن قوانین مرجوعی و … */
export function htmlToText(html: string, max = 4000): string {
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&zwnj;/g, "‌")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** قیمت تومانی به متن فارسی — صفر یعنی «استعلامی» (قیمت روز را کارشناس می‌گوید) */
export function priceLabel(value: bigint | number | null | undefined): string {
  const n = Number(value ?? 0);
  return n > 0 ? `${n.toLocaleString("fa-IR")} تومان` : "استعلامی (قیمت روز را کارشناس اعلام می‌کند)";
}
