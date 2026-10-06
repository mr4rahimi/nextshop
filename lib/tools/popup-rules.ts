/**
 * قواعد پاپ‌آپ — نوع‌ها، پاک‌سازی محتوا، تطبیق صفحه و دستگاه و دفعات نمایش.
 *
 * ⚠️ بدون Prisma و Next: سرور (ذخیره و فهرست عمومی)، میزبان پاپ‌آپ در سایت و
 * پیش‌نمایش پنل هر سه از همین فایل می‌خوانند.
 *
 * مستندات: docs/features/tools.md بخش ۹
 */

export type PopupKind = "ANNOUNCE" | "LEAD";
export type PopupTrigger = "DELAY" | "SCROLL" | "EXIT";
export type PopupPages = "ALL" | "HOME" | "PRODUCT" | "CATEGORY" | "CUSTOM";
export type PopupDevice = "ALL" | "MOBILE" | "DESKTOP";
export type PopupFrequency = "SESSION" | "DAY" | "WEEK" | "ONCE";
export type PopupPosition = "AUTO" | "CENTER" | "BOTTOM";

export interface PopupContent {
  heading: string;
  body: string;
  imageUrl: string;
  buttonText: string;
  buttonUrl: string;
  /** فقط LEAD: کدی که بعد از ثبت شماره نشان داده می‌شود (از کدهای تخفیف باشگاه) */
  couponCode: string;
  /** فقط LEAD: متن بعد از ثبت */
  successText: string;
  /** فقط LEAD: متن تیک رضایت پیامک تبلیغاتی؛ خالی = تیک نشان داده نمی‌شود */
  consentText: string;
}

/** آنچه به مرورگر بازدیدکننده می‌رود — بدون آمار و نام داخلی */
export interface PopupPublic {
  id: string;
  kind: PopupKind;
  priority: number;
  content: PopupContent;
  trigger: PopupTrigger;
  triggerValue: number;
  pages: PopupPages;
  paths: string[];
  device: PopupDevice;
  frequency: PopupFrequency;
  position: PopupPosition;
  accent: string;
  startsAt: string | null;
  endsAt: string | null;
  /** نسخه‌ی محتوا — ویرایش، پاپ‌آپ را دوباره به کسی که بسته بود نشان می‌دهد */
  version: string;
}

export const EMPTY_CONTENT: PopupContent = {
  heading: "",
  body: "",
  imageUrl: "",
  buttonText: "",
  buttonUrl: "",
  couponCode: "",
  successText: "",
  consentText: "",
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** فقط مسیر داخلی یا http(s) — `javascript:` و `data:` هرگز */
export function safeHref(v: unknown): string {
  const u = str(v, 500);
  if (!u) return "";
  if (u.startsWith("/") && !u.startsWith("//")) return u;
  if (/^https?:\/\/\S+$/i.test(u)) return u;
  return "";
}

/** عکس: فقط کتابخانه‌ی رسانه یا https */
export function safeImage(v: unknown): string {
  const u = str(v, 500);
  if (/^\/uploads\/\S+$/.test(u) || /^https:\/\/\S+$/i.test(u)) return u;
  return "";
}

export function sanitizeContent(raw: unknown): PopupContent {
  const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    heading: str(c.heading, 120),
    body: str(c.body, 600),
    imageUrl: safeImage(c.imageUrl),
    buttonText: str(c.buttonText, 40),
    buttonUrl: safeHref(c.buttonUrl),
    couponCode: str(c.couponCode, 40).toUpperCase(),
    successText: str(c.successText, 300),
    consentText: str(c.consentText, 200),
  };
}

export function pick<T extends string>(v: unknown, allowed: readonly T[], def: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : def;
}

export const TRIGGERS = ["DELAY", "SCROLL", "EXIT"] as const;
export const PAGES = ["ALL", "HOME", "PRODUCT", "CATEGORY", "CUSTOM"] as const;
export const DEVICES = ["ALL", "MOBILE", "DESKTOP"] as const;
export const FREQUENCIES = ["SESSION", "DAY", "WEEK", "ONCE"] as const;
export const POSITIONS = ["AUTO", "CENTER", "BOTTOM"] as const;

export function safeAccent(v: unknown): string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim() : "#2563eb";
}

/** پیشوندهای CUSTOM: هر خط یک مسیر که با / شروع شود */
export function cleanPaths(v: unknown): string[] {
  const list = Array.isArray(v) ? v : typeof v === "string" ? v.split(/\n|,/) : [];
  return [...new Set(list.map((x) => (typeof x === "string" ? x.trim() : "")).filter((x) => x.startsWith("/") && x.length <= 200))].slice(0, 30);
}

// ─── کجا نشان داده شود ───────────────────────────────────────────────────

/**
 * پاپ‌آپ هرگز روی این مسیرها نمی‌آید: وسط خرید، ورود و حساب کاربری مزاحم است.
 */
const NEVER = ["/cart", "/checkout", "/c", "/user", "/auth", "/account", "/seller"];

const underPrefix = (path: string, prefix: string) => {
  const base = prefix.replace(/\/+$/, "") || "/";
  return path === base || path.startsWith(`${base}/`);
};

export function isExcludedPath(path: string): boolean {
  return NEVER.some((p) => underPrefix(path, p));
}

export function matchesPage(p: Pick<PopupPublic, "pages" | "paths">, path: string): boolean {
  if (isExcludedPath(path)) return false;
  switch (p.pages) {
    case "HOME":
      return path === "/";
    case "PRODUCT":
      return path.startsWith("/products/");
    case "CATEGORY":
      return path.startsWith("/categories/") || path.startsWith("/collections/");
    case "CUSTOM":
      return p.paths.some((x) => underPrefix(path, x));
    default:
      return true;
  }
}

export function matchesDevice(d: PopupDevice, isMobile: boolean): boolean {
  return d === "ALL" || (d === "MOBILE" ? isMobile : !isMobile);
}

export function inWindow(p: Pick<PopupPublic, "startsAt" | "endsAt">, now: number): boolean {
  if (p.startsAt && new Date(p.startsAt).getTime() > now) return false;
  if (p.endsAt && new Date(p.endsAt).getTime() < now) return false;
  return true;
}

const FREQ_MS: Record<PopupFrequency, number> = { SESSION: 0, DAY: 86_400_000, WEEK: 7 * 86_400_000, ONCE: Infinity };

/**
 * با زمان آخرین نمایش (همان نسخه)، الان دوباره نشان داده شود؟
 * ⚠️ SESSION همیشه `true` است: «در این بازدید دیده شده» را میزبان با sessionStorage
 * می‌سنجد؛ زمانِ ذخیره در localStorage نباید بازدید بعدی را هم ببندد.
 */
export function dueAgain(freq: PopupFrequency, lastShown: number | null, now: number): boolean {
  if (freq === "SESSION" || lastShown === null) return true;
  return now - lastShown >= FREQ_MS[freq];
}

/** هش کوتاه محتوا — ویرایش متن یعنی نسخه‌ی تازه (همان روش نوار اعلان) */
export function contentVersion(c: PopupContent, kind: PopupKind): string {
  const src = `${kind}|${c.heading}|${c.body}|${c.buttonUrl}|${c.couponCode}`;
  let h = 5381;
  for (let i = 0; i < src.length; i++) h = ((h << 5) + h + src.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
