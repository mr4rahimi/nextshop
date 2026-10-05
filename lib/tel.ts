/**
 * `href` لینک `tel:` از فیلد تلفن آزاد تنظیمات.
 *
 * فیلد تلفن معمولاً چند شماره دارد («09129449453 - 09393338545 - 02188314150»)
 * و قبلاً همه‌اش خام در `href` می‌نشست — دکمه‌ی تماس موبایل کار نمی‌کرد (ممیزی
 * مهر ۱۴۰۵). حالا فقط **اولین** شماره می‌آید. خط تیره‌ی بی‌فاصله
 * (`021-88314150`) جداکننده نیست و بخشی از همان شماره است.
 */
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function latinDigits(s: string): string {
  return s.replace(/[۰-۹٠-٩]/g, (d) => {
    const i = FA_DIGITS.indexOf(d);
    return String(i >= 0 ? i : AR_DIGITS.indexOf(d));
  });
}

/** اولین شماره به شکل `09121234567` یا `+98…`؛ بی‌شماره → `null` */
export function firstPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const chunk = latinDigits(raw).split(/[,،;\/|\n]|\s+(?:-|–|—|یا|و)\s+/)[0] ?? "";
  let num = chunk.replace(/[^\d+]/g, "");
  // چند شماره فقط با فاصله: «0912… 0939…» — اولین تکه‌ی عددی کافی است
  if (num.length > 13) num = (chunk.trim().split(/\s+/)[0] ?? "").replace(/[^\d+]/g, "");
  num = num.replace(/(?!^)\+/g, "");
  return /\d{3,}/.test(num) ? num : null;
}

export function telHref(raw: string | null | undefined): string | null {
  const n = firstPhone(raw);
  return n ? `tel:${n}` : null;
}
