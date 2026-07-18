/**
 * جایگزینی متغیرها در متن پیامک
 *
 * دو نحو پشتیبانی می‌شود:
 *   {name}  → نحو داخلی، هنگام ارسال تکی جایگزین می‌شود
 *   %name%  → نحو پنل، در ارسال گروهی (`keywords`) خود پنل جایگزین می‌کند
 *
 * قالب‌ها همیشه با `{name}` نوشته می‌شوند و در زمان ارسال گروهی
 * به `%name%` تبدیل می‌گردند.
 */

export const TEMPLATE_VARIABLES = [
  { key: "name", label: "نام مشتری" },
  { key: "fullname", label: "نام و نام خانوادگی" },
  { key: "points", label: "امتیاز فعلی" },
  { key: "tier", label: "سطح عضویت" },
  { key: "store", label: "نام فروشگاه" },
  { key: "code", label: "کد تخفیف" },
  { key: "orders", label: "تعداد خرید" },
] as const;

const PLACEHOLDER = /\{(\w+)\}/g;

/** استخراج نام متغیرهای به‌کاررفته در یک متن */
export function extractVariables(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(PLACEHOLDER)) found.add(m[1]);
  return [...found];
}

/** جایگزینی واقعی مقادیر — برای ارسال تکی */
export function renderTemplate(
  text: string,
  vars: Record<string, string | number | null | undefined>
): string {
  return text.replace(PLACEHOLDER, (_, key: string) => {
    const v = vars[key];
    return v === null || v === undefined ? "" : String(v);
  });
}

/** تبدیل `{name}` به `%name%` — برای ارسال گروهی از طریق پنل */
export function toProviderSyntax(text: string): string {
  return text.replace(PLACEHOLDER, (_, key: string) => `%${key}%`);
}

/**
 * افزودن متن لغو به انتهای پیام تبلیغاتی.
 * اگر متن از قبل شامل عبارت لغو باشد، دوباره اضافه نمی‌شود.
 */
export function appendOptOut(text: string, optOutText?: string | null): string {
  const suffix = optOutText?.trim();
  if (!suffix) return text;
  if (text.includes(suffix) || /لغو\s*\d*/.test(text.slice(-25))) return text;
  return `${text}\n${suffix}`;
}

/**
 * تخمین تعداد بخش‌های پیامک (برای نمایش هزینه به ادمین)
 * فارسی = UCS-2 → ۷۰ کاراکتر تک‌بخشی، ۶۷ کاراکتر در حالت چندبخشی
 */
export function countSmsParts(text: string): { chars: number; parts: number; unicode: boolean } {
  const unicode = /[^\x00-\x7F]/.test(text);
  const chars = text.length;

  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;

  const parts = chars === 0 ? 0 : chars <= single ? 1 : Math.ceil(chars / multi);

  return { chars, parts, unicode };
}

/**
 * پیش‌نمایش قالب با مقادیر نمونه — برای صفحه ادمین
 */
export function previewTemplate(text: string, storeName = "فروشگاه"): string {
  return renderTemplate(text, {
    name: "مهدی",
    fullname: "مهدی رحیمی",
    points: 1250,
    tier: "طلایی",
    store: storeName,
    code: "BDAY25",
    orders: 4,
  });
}