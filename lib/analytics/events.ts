/**
 * نام و برچسب رویدادهای تجاری و برچسب‌های آمار بازدید.
 *
 * **نام رویداد فقط همین‌جا تعریف می‌شود** — هم ردیاب از آن می‌فرستد و هم پنل
 * برچسبش را از آن می‌خواند. درس برتر: دو جای جدا یعنی روزی رویداد بی‌نام در
 * گزارش.
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۱۳.۴
 */

export const EVENTS = {
  addToCart: "add_to_cart",
  beginCheckout: "begin_checkout",
  placeOrder: "place_order",
  phoneClick: "phone_click",
  whatsappClick: "whatsapp_click",
  chatOpen: "chat_open",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

/** ترتیب همین فهرست ترتیب قیف در پنل است */
export const EVENT_LABELS: Record<string, string> = {
  add_to_cart: "افزودن به سبد",
  begin_checkout: "ورود به تسویه",
  place_order: "ثبت سفارش",
  phone_click: "کلیک روی شماره‌ی تلفن",
  whatsapp_click: "کلیک روی واتساپ",
  chat_open: "باز کردن چت",
};

/** سه مرحله‌ی قیف خرید — بقیه‌ی رویدادها «تماس» شمرده می‌شوند */
export const FUNNEL_EVENTS = ["add_to_cart", "begin_checkout", "place_order"] as const;

/**
 * کانال ورود — کلیدهای Umami به‌علاوه‌ی `comparison` خودمان
 * (`lib/analytics/attribution.ts`). کلید ناشناخته خام نمایش داده می‌شود.
 */
export const CHANNEL_LABELS: Record<string, string> = {
  direct: "ورود مستقیم",
  referral: "ارجاع از سایت دیگر",
  organicSearch: "جستجوی طبیعی",
  paidSearch: "جستجوی تبلیغاتی",
  organicSocial: "شبکه‌ی اجتماعی",
  paidSocial: "شبکه‌ی اجتماعی تبلیغاتی",
  organicVideo: "ویدئو",
  paidVideo: "ویدئو تبلیغاتی",
  organicShopping: "فروشگاهی",
  paidShopping: "فروشگاهی تبلیغاتی",
  comparison: "ترب و بازارگاه‌ها",
  paidAds: "تبلیغات",
  affiliate: "همکاری در فروش",
  email: "ایمیل",
  sms: "پیامک",
  llm: "هوش مصنوعی",
  unknown: "نامشخص",
  other: "سایر",
};

export const DEVICE_LABELS: Record<string, string> = {
  desktop: "رایانه",
  laptop: "لپ‌تاپ",
  tablet: "تبلت",
  mobile: "موبایل",
  wearable: "پوشیدنی",
  console: "کنسول",
  tv: "تلویزیون",
  unknown: "نامشخص",
};

export const COUNTRY_LABELS: Record<string, string> = {
  IR: "ایران", TR: "ترکیه", DE: "آلمان", US: "آمریکا", GB: "انگلستان", CA: "کانادا",
  AE: "امارات", IQ: "عراق", AF: "افغانستان", NL: "هلند", FR: "فرانسه", SE: "سوئد",
  RU: "روسیه", CN: "چین", IN: "هند", AU: "استرالیا", IT: "ایتالیا", ES: "اسپانیا",
  AZ: "آذربایجان", AM: "ارمنستان", GE: "گرجستان", QA: "قطر", OM: "عمان", KW: "کویت",
  FI: "فنلاند", MY: "مالزی",
};

/** بازه‌ها — `days` برای دوره‌ی قبلِ هم‌طول هم استفاده می‌شود */
export const ANALYTICS_RANGES = [
  { key: "24h", label: "۲۴ ساعت", days: 1 },
  { key: "7d", label: "۷ روز", days: 7 },
  { key: "30d", label: "۳۰ روز", days: 30 },
  { key: "90d", label: "۹۰ روز", days: 90 },
] as const;

export type AnalyticsRangeKey = (typeof ANALYTICS_RANGES)[number]["key"];
export const DEFAULT_RANGE: AnalyticsRangeKey = "30d";

export function rangeOf(key: string | null | undefined) {
  return ANALYTICS_RANGES.find((r) => r.key === key) ?? ANALYTICS_RANGES[2];
}
