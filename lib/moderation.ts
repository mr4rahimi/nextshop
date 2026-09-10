/**
 * ابزارهای مشترک نظرات — هم نظر محصول، هم نظر مقاله.
 *
 * هر دو بخش یک جور ورودی می‌گیرند (متن آزاد از کسی که لزوماً وارد نشده) و
 * باید یک جور با آن رفتار کنند. هر قاعده‌ای که اینجا نباشد، دیر یا زود در
 * یکی از دو بخش فراموش می‌شود.
 *
 * مستندات: docs/features/reviews.md
 */

/** متن ورودی کاربر: تمیزکردن فاصله‌ها و بریدن به سقف مجاز */
export function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * متن چندخطی: خطوط حفظ می‌شوند ولی خط خالیِ پشت‌سرهم جمع می‌شود.
 *
 * برای متن نظر لازم است — `clean` همه‌ی خطوط را به یک خط می‌چسباند و
 * پاراگراف‌بندی نویسنده از بین می‌رود.
 */
export function cleanMultiline(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

/** فهرست کوتاه (نقاط قوت/ضعف): خالی‌ها حذف، تکراری‌ها حذف، سقف تعداد */
export function cleanList(value: unknown, max: number, count: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const raw of value) {
    const item = clean(raw, max);
    if (item && !out.includes(item)) out.push(item);
    if (out.length >= count) break;
  }
  return out;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/** نشانی درخواست‌دهنده — پشت nginx از `x-forwarded-for` خوانده می‌شود */
export function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : req.headers.get("x-real-ip");
}

/**
 * کلید رأی‌دهنده برای رأی «مفید بود».
 *
 * کاربر عضو شناسه‌ی خودش، مهمان نشانی IP. `null` یعنی اصلاً نمی‌شود
 * رأی را به کسی نسبت داد و رأی پذیرفته نمی‌شود.
 */
export function voterKey(userId: string | null, ip: string | null): string | null {
  if (userId) return `u:${userId}`;
  return ip ? `ip:${ip}` : null;
}

/**
 * نامی که عمومی نمایش داده می‌شود.
 *
 * شماره‌ی موبایل هرگز جای نام نمی‌نشیند — در صفحه‌ی عمومی نباید دیده شود.
 */
export function publicAuthorName(input: {
  guestName: string | null;
  user: { firstName: string | null; lastName: string | null } | null;
}): string {
  if (input.user) {
    const name = [input.user.firstName, input.user.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (name) return name;
  }
  return input.guestName?.trim() || "کاربر مهمان";
}
