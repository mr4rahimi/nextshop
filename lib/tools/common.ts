/**
 * پایه‌ی مشترک ابزارها — توکن، قواعد آدرس، UTM، ساعت تهران.
 *
 * ⚠️ این فایل Prisma و Next ایمپورت نمی‌کند: فرم‌های پنل در مرورگر هم از
 * همین قواعد استفاده می‌کنند تا خطای فرم و خطای سرور یکی باشد.
 *
 * مستندات: docs/features/tools.md
 */

/**
 * الفبای توکن بدون حروف مبهم (`0/o`، `1/l/i`) — مشتری گاهی لینک را از روی
 * پیامک یا کاغذ تایپ می‌کند.
 */
const TOKEN_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function randomToken(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += TOKEN_ALPHABET[b % TOKEN_ALPHABET.length];
  return out;
}

/** پیام خطایی که مستقیم به کاربر پنل نشان داده می‌شود */
export class ToolError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// ─── آدرس مقصد ───────────────────────────────────────────────────────────

/**
 * فقط این طرح‌ها از فرم ادمین به صفحه‌ی عمومی راه پیدا می‌کنند.
 * `javascript:` و `data:` هرگز — لینک کوتاه و دکمه‌ی لندینگ روی گوشی مشتری
 * باز می‌شوند.
 */
const SAFE_SCHEMES = /^(https?:\/\/[^\s]+|tel:\+?[\d\-\s()]{3,}|mailto:[^\s@]+@[^\s@]+)$/i;

/**
 * آدرسی که ادمین تایپ کرده را کامل می‌کند:
 * `/products/x` → آدرس کامل روی دامنه‌ی همین سایت، `example.com` → `https://example.com`.
 * `null` یعنی پذیرفته نیست.
 */
export function normalizeTarget(raw: string, siteUrl: string): string | null {
  let v = (raw ?? "").trim();
  if (!v) return null;
  if (v.startsWith("/") && !v.startsWith("//")) v = siteUrl.replace(/\/+$/, "") + v;
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(v) && /^[^\s/]+\.[^\s/]+/.test(v)) v = `https://${v}`;
  return SAFE_SCHEMES.test(v) ? v : null;
}

export const TARGET_HINT = "آدرس با https:// یا مسیر سایت مثل /products/… — یا tel: و mailto:";

export interface Utm {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
}

/**
 * UTM فرم را به مقصد اضافه می‌کند — فقط برای http(s)، و پارامتری که مقصد
 * خودش دارد دست نمی‌خورد.
 */
export function withUtm(target: string, utm: Utm): string {
  if (!/^https?:\/\//i.test(target)) return target;
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return target;
  }
  const pairs: [string, string | null | undefined][] = [
    ["utm_source", utm.utmSource],
    ["utm_medium", utm.utmMedium],
    ["utm_campaign", utm.utmCampaign],
  ];
  for (const [k, v] of pairs) {
    if (v && !url.searchParams.has(k)) url.searchParams.set(k, v);
  }
  return url.toString();
}

/** UTM فقط حروف لاتین، عدد، خط تیره و زیرخط — فاصله و فارسی در گزارش‌ها دردسر است */
export function cleanUtm(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_\-.]/g, "").slice(0, 60);
  return t || null;
}

/** آدرس بدون `https://` — برای پیامک و نمایش کوتاه */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

// ─── نامک ────────────────────────────────────────────────────────────────

/** نامک لینک کوتاه و لندینگ: حروف کوچک لاتین، عدد و خط تیره */
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

export function cleanSlug(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

// ─── ساعت تهران ──────────────────────────────────────────────────────────

const tehranHourFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Tehran",
  hour: "numeric",
  hourCycle: "h23",
});

export function tehranHour(d = new Date()): number {
  return Number(tehranHourFmt.format(d)) % 24;
}

const tehranDayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tehran",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** کلید روز به ساعت تهران — `YYYY-MM-DD` (سرور روی UTC است) */
export function tehranDayKey(d: Date): string {
  return tehranDayFmt.format(d);
}

/**
 * «YYYY-MM-DD» → پایان همان روز به ساعت تهران.
 * تهران از ۱۴۰۱ ساعت تابستانی ندارد، پس افست ثابت ۳:۳۰ است.
 */
export function endOfTehranDay(dateValue: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null;
  const d = new Date(`${dateValue}T23:59:59.999+03:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** لحظه → «YYYY-MM-DD» روز تهران، برای مقدار اولیه‌ی تقویم */
export function toTehranDateValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  const x = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(x.getTime()) ? "" : tehranDayKey(x);
}

export const fa = (n: number) => n.toLocaleString("fa-IR");
