/**
 * انتخاب خودکار رنگ متن بر اساس روشناییِ پس‌زمینه.
 *
 * وقتی ادمین رنگ پس‌زمینه‌ی دلخواه می‌گذارد، رنگ متن نباید از حالت روز/شب سایت
 * پیروی کند: یک پس‌زمینه‌ی روشن در حالت شب باعث می‌شود متنِ روشن روی زمینه‌ی روشن
 * بیفتد و خوانده نشود. این ماژول همان محاسبه‌ی استاندارد دسترسی‌پذیری را انجام
 * می‌دهد و بین ویجت‌های مختلف مشترک است.
 */

const DARK_TEXT = "#111827";
const LIGHT_TEXT = "#f9fafb";

/** روشنایی نسبی sRGB — طبق فرمول WCAG */
export function luminance(hex: string): number {
  const h = (hex ?? "").trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return 1;
  const ch = [0, 2, 4].map(i => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/**
 * رنگ متن مناسب برای یک یا چند رنگ پس‌زمینه.
 * برای گرادینت، میانگین روشنایی دو سر گرادینت ملاک است.
 */
export function contrastTextColor(...backgrounds: string[]): string {
  if (backgrounds.length === 0) return DARK_TEXT;
  const avg = backgrounds.reduce((sum, c) => sum + luminance(c), 0) / backgrounds.length;
  return avg > 0.45 ? DARK_TEXT : LIGHT_TEXT;
}
