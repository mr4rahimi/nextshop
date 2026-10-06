/**
 * نوار اعلان بالای سایت — یک پیام باریک و چسبان بالای همه‌ی صفحات.
 *
 * این فایل عمداً `use client` ندارد و به Prisma هم وابسته نیست، تا سرور
 * (`components/layout/Header.tsx`)، فرم ادمین و مسیر API هر سه از یک منبع
 * استفاده کنند — همان الگویی که `headers/registry.ts` برای هدر شیشه‌ای دارد.
 */

export interface AnnouncementBarConfig {
  /** نمایش نوار */
  enabled: boolean;
  /** متن پیام (بدون HTML) */
  text: string;
  /** لینک اختیاری؛ خالی یعنی نوار کلیک‌پذیر نیست */
  linkUrl: string;
  /** رنگ پس‌زمینه */
  bgColor: string;
  /** رنگ متن */
  textColor: string;
  /** نمایش دکمه‌ی ضربدر برای بستن توسط کاربر */
  dismissible: boolean;
  /** چسبان بالای صفحه (با اسکرول می‌ماند) یا فقط در ابتدای صفحه */
  sticky: boolean;
  /** شروع نمایش «YYYY-MM-DDTHH:mm» به وقت تهران؛ خالی = از همین حالا */
  startsAt: string;
  /** پایان نمایش با همان قالب؛ خالی = بی‌پایان */
  endsAt: string;
  /** شمارش معکوس تا `endsAt` کنار متن */
  countdown: boolean;
}

export const DEFAULT_ANNOUNCEMENT_BAR: AnnouncementBarConfig = {
  enabled: false,
  text: "",
  linkUrl: "",
  bgColor: "#1e40af",
  textColor: "#ffffff",
  dismissible: true,
  sticky: true,
  startsAt: "",
  endsAt: "",
  countdown: false,
};

/** حداکثر طول متن — نوار باید باریک بماند */
export const ANNOUNCEMENT_TEXT_MAX = 300;

/** کلید localStorage که انتخاب «بستن» کاربر در آن ذخیره می‌شود */
export const ANNOUNCEMENT_STORAGE_KEY = "announcement-dismissed";

/** کلاسی که روی <html> می‌نشیند تا نوارِ بسته‌شده قبل از اولین رنگ‌آمیزی مخفی شود */
export const ANNOUNCEMENT_OFF_CLASS = "ann-off";

function safeColor(v: unknown, fallback: string): string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim() : fallback;
}

function safeBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

/** فقط لینک داخلی یا http(s) — جلوی `javascript:` و امثالش گرفته می‌شود */
function safeUrl(v: unknown): string {
  if (typeof v !== "string") return "";
  const u = v.trim();
  if (!u) return "";
  if (u.startsWith("/")) return u.slice(0, 500);
  if (/^https?:\/\//i.test(u)) return u.slice(0, 500);
  return "";
}

/** هر ورودی‌ای (از DB یا فرم ادمین) را به یک config معتبر تبدیل می‌کند */
export function normalizeAnnouncementBar(raw: unknown): AnnouncementBarConfig {
  const c = (raw && typeof raw === "object" ? raw : {}) as Partial<AnnouncementBarConfig>;
  const text = typeof c.text === "string" ? c.text.trim().slice(0, ANNOUNCEMENT_TEXT_MAX) : "";
  return {
    enabled:     safeBool(c.enabled, DEFAULT_ANNOUNCEMENT_BAR.enabled),
    text,
    linkUrl:     safeUrl(c.linkUrl),
    bgColor:     safeColor(c.bgColor, DEFAULT_ANNOUNCEMENT_BAR.bgColor),
    textColor:   safeColor(c.textColor, DEFAULT_ANNOUNCEMENT_BAR.textColor),
    dismissible: safeBool(c.dismissible, DEFAULT_ANNOUNCEMENT_BAR.dismissible),
    sticky:      safeBool(c.sticky, DEFAULT_ANNOUNCEMENT_BAR.sticky),
    startsAt:    safeDateTime(c.startsAt),
    endsAt:      safeDateTime(c.endsAt),
    countdown:   safeBool(c.countdown, DEFAULT_ANNOUNCEMENT_BAR.countdown),
  };
}

function safeDateTime(v: unknown): string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v.trim()) ? v.trim() : "";
}

/**
 * «YYYY-MM-DDTHH:mm» تهران ← میلی‌ثانیه. تهران از ۱۴۰۱ ساعت تابستانی ندارد، پس افست
 * ثابت ۳:۳۰ است — سرور (UTC) و مرورگر (هر منطقه‌ای) یک لحظه را می‌فهمند.
 */
export function tehranMs(v: string): number | null {
  if (!v) return null;
  const t = new Date(`${v}:00+03:30`).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * آیا نوار باید رندر شود؟ فعال + متن غیرخالی + هنوز تمام نشده.
 * شروعِ آینده رندر می‌شود ولی اسکریپت inline پنهانش می‌کند — صفحه‌ی کش‌شده هم
 * سر ساعت درست رفتار کند.
 */
export function isAnnouncementVisible(cfg: AnnouncementBarConfig, now = Date.now()): boolean {
  if (!cfg.enabled || cfg.text.trim().length === 0) return false;
  const end = tehranMs(cfg.endsAt);
  return end === null || end > now;
}

/**
 * «نسخه»ی پیام — هش کوتاه متن و لینک.
 *
 * انتخاب «بستن» کاربر با همین کلید ذخیره می‌شود؛ بنابراین وقتی ادمین متن اعلان را
 * عوض کند کلید هم عوض می‌شود و پیام جدید دوباره به همه نشان داده می‌شود، بدون
 * اینکه لازم باشد ادمین چیزی را دستی ریست کند.
 */
export function announcementKey(cfg: AnnouncementBarConfig): string {
  const src = `${cfg.text}|${cfg.linkUrl}`;
  let h = 5381;
  for (let i = 0; i < src.length; i++) h = ((h << 5) + h + src.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
