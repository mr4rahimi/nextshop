/**
 * کلیک انسانی یا ربات؟ و چه دستگاهی؟ — مشترک لینک کوتاه، لندینگ و صفحه‌ی نظر.
 *
 * ⚠️ تلگرام، واتساپ، اینستاگرام، ایتا و بله برای ساختن پیش‌نمایش لینک را
 * **خودشان** باز می‌کنند — هر بار که لینک در گروهی فرستاده شود. بدون جداکردن،
 * آمار چند برابر دروغ می‌شود. ربات‌ها ریدایرکت می‌شوند (پیش‌نمایش باید کار
 * کند) ولی جدا شمرده می‌شوند.
 *
 * مستندات: docs/features/tools.md بخش ۱
 */

const BOT_UA =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|facebookcatalog|whatsapp|telegram|twitterbot|linkedinbot|discord|skype|slack|embedly|pinterest|vkshare|eitaa|bale|rubika|quora link|outbrain|headless|lighthouse|curl|wget|python-requests|go-http-client|okhttp|axios|node-fetch|java\//i;

export function isBotRequest(req: Request): boolean {
  if (req.method === "HEAD") return true;
  const h = req.headers;
  const purpose = `${h.get("purpose") ?? ""} ${h.get("sec-purpose") ?? ""} ${h.get("x-purpose") ?? ""}`;
  if (/prefetch|preview/i.test(purpose)) return true;
  const ua = h.get("user-agent") ?? "";
  if (!ua) return true;
  return BOT_UA.test(ua);
}

export function deviceOf(ua: string): "mobile" | "tablet" | "desktop" {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android/i.test(ua)) return "mobile";
  return "desktop";
}

export function osOf(ua: string): string {
  if (/iphone|ipad|ipod|ios/i.test(ua)) return "iOS";
  if (/android/i.test(ua)) return "Android";
  if (/windows/i.test(ua)) return "Windows";
  if (/mac os x|macintosh/i.test(ua)) return "macOS";
  if (/linux/i.test(ua)) return "Linux";
  return "سایر";
}

export function referrerHostOf(req: Request): string | null {
  const ref = req.headers.get("referer");
  if (!ref) return null;
  try {
    return new URL(ref).hostname.replace(/^www\./, "").slice(0, 120) || null;
  } catch {
    return null;
  }
}

export const DEVICE_LABEL: Record<string, string> = {
  mobile: "موبایل",
  tablet: "تبلت",
  desktop: "دسکتاپ",
};
