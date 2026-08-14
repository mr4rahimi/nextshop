export type HomeHeaderVariant = "DEFAULT" | "UNIQUE_STAR" | "GLASS";

/** دامنه‌ی اعمال هدر: کل سایت یا فقط صفحه اصلی */
export type HeaderScope = "site" | "home";

export interface HeaderVariantMeta {
  id: HomeHeaderVariant;
  label: string;
  desc: string;
  /** آیا این هدر شفاف است و روی اولین ویجت می‌افتد؟ */
  overlay: boolean;
  /** هدر روی کل سایت اعمال می‌شود یا فقط روی صفحه اصلی؟ */
  scope: HeaderScope;
  /** نکته‌ای که در پنل ادمین به مدیر نشان داده می‌شود */
  hint?: string;
}

export const HEADER_VARIANTS: HeaderVariantMeta[] = [
  {
    id: "DEFAULT",
    label: "هدر پیش‌فرض",
    desc: "هدر استاندارد فروشگاه با لوگو، جستجو، مگامنو و سبد خرید",
    overlay: false,
    scope: "site",
  },
  {
    id: "UNIQUE_STAR",
    label: "هدر یونیک استار (شفاف)",
    desc: "هدر شفاف تیره که روی بنر هرو می‌نشیند و با اسکرول تیره می‌شود",
    overlay: true,
    scope: "home",
    hint: "برای بهترین نتیجه، اولین ویجت فعال صفحه اصلی را «بنر هرو یونیک استار» قرار دهید و گزینه «فضای هدر شفاف» را در آن ویجت روشن بگذارید.",
  },
  {
    id: "GLASS",
    label: "هدر شفاف (شیشه‌ای)",
    desc: "مشابه هدر پیش‌فرض اما با پس‌زمینه‌ی شیشه‌ای و شفاف که با اسکرول شفاف‌تر و بلورتر می‌شود. در موبایل، نوار جستجوی تمام‌عرض با اسکرول به آیکن جستجو تبدیل می‌شود.",
    overlay: false,
    scope: "site",
    hint: "این هدر روی همه‌ی صفحات سایت اعمال می‌شود. میزان شفافیت، شدت بلور و رنگ‌بندی آن را از بخش «تنظیمات ظاهری هدر شیشه‌ای» در همین صفحه تغییر دهید.",
  },
];

export function isOverlayVariant(v: string | null | undefined): boolean {
  return HEADER_VARIANTS.find(h => h.id === v)?.overlay ?? false;
}

export function normalizeVariant(v: string | null | undefined): HomeHeaderVariant {
  return HEADER_VARIANTS.some(h => h.id === v) ? (v as HomeHeaderVariant) : "DEFAULT";
}

export function variantScope(v: string | null | undefined): HeaderScope {
  return HEADER_VARIANTS.find(h => h.id === normalizeVariant(v))?.scope ?? "site";
}

/* ───────────────────────── تنظیمات ظاهری هدر شیشه‌ای ───────────────────────── */

export interface GlassHeaderConfig {
  /** شفافیت پس‌زمینه قبل از اسکرول — ۰ تا ۱۰۰ */
  opacityTop: number;
  /** شفافیت پس‌زمینه بعد از اسکرول — ۰ تا ۱۰۰ */
  opacityScrolled: number;
  /** شدت بلور قبل از اسکرول (px) */
  blurTop: number;
  /** شدت بلور بعد از اسکرول (px) */
  blurScrolled: number;
  /** رنگ تینت پس‌زمینه در حالت روز */
  tintLight: string;
  /** رنگ تینت پس‌زمینه در حالت شب */
  tintDark: string;
  /** رنگ متن و آیکن‌ها در حالت روز */
  textLight: string;
  /** رنگ متن و آیکن‌ها در حالت شب */
  textDark: string;
  /** نمایش خط حاشیه‌ی پایین هدر */
  showBorder: boolean;
}

export const DEFAULT_GLASS_CONFIG: GlassHeaderConfig = {
  opacityTop: 35,
  opacityScrolled: 55,
  blurTop: 10,
  blurScrolled: 24,
  tintLight: "#ffffff",
  tintDark: "#050505",
  textLight: "#1f2937",
  textDark: "#f3f4f6",
  showBorder: true,
};

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function safeColor(v: unknown, fallback: string): string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim() : fallback;
}

/** هر ورودی‌ای (از DB یا فرم ادمین) را به یک config معتبر تبدیل می‌کند */
export function normalizeGlassConfig(raw: unknown): GlassHeaderConfig {
  const c = (raw && typeof raw === "object" ? raw : {}) as Partial<GlassHeaderConfig>;
  return {
    opacityTop:      clampNum(c.opacityTop, 0, 100, DEFAULT_GLASS_CONFIG.opacityTop),
    opacityScrolled: clampNum(c.opacityScrolled, 0, 100, DEFAULT_GLASS_CONFIG.opacityScrolled),
    blurTop:         clampNum(c.blurTop, 0, 40, DEFAULT_GLASS_CONFIG.blurTop),
    blurScrolled:    clampNum(c.blurScrolled, 0, 40, DEFAULT_GLASS_CONFIG.blurScrolled),
    tintLight:       safeColor(c.tintLight, DEFAULT_GLASS_CONFIG.tintLight),
    tintDark:        safeColor(c.tintDark, DEFAULT_GLASS_CONFIG.tintDark),
    textLight:       safeColor(c.textLight, DEFAULT_GLASS_CONFIG.textLight),
    textDark:        safeColor(c.textDark, DEFAULT_GLASS_CONFIG.textDark),
    showBorder:      typeof c.showBorder === "boolean" ? c.showBorder : DEFAULT_GLASS_CONFIG.showBorder,
  };
}

/** hex → "r, g, b" برای استفاده در rgba() */
export function hexToRgbChannels(hex: string): string {
  if (!/^#?[0-9a-fA-F]{6}$/.test((hex ?? "").trim())) return "0, 0, 0";
  const h = hex.trim().replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}
