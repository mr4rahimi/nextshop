/**
 * تنظیم چاپ برچسب بارکد — مشترک مرورگر و سرور (بی prisma).
 * ذخیره در `AccSettings.labelConfig`؛ همه‌ی کاربران یک تنظیم می‌بینند.
 *
 * رول: هر «ردیف» `cols` برچسب کنار هم یک صفحه‌ی چاپ است (عرض رول × ارتفاع برچسب).
 * A4: برچسب‌ها در جدول `cols` ستونی، صفحه‌به‌صفحه.
 */

export type LabelMedia = "roll" | "a4";
export type PriceUnit = "toman" | "rial";

export interface LabelConfig {
  media: LabelMedia;
  /** اندازه‌ی هر برچسب به میلی‌متر */
  w: number;
  h: number;
  /** چند برچسب کنار هم (رول دوتایی = ۲) */
  cols: number;
  /** فاصله‌ی افقی و عمودی بین برچسب‌ها */
  gapX: number;
  gapY: number;
  /** حاشیه‌ی راست/چپ؛ بالا = جابه‌جایی برچسب‌ها به پایین (رول و A4) */
  marginX: number;
  marginTop: number;
  /** متن بالای برچسب، مثلاً نام فروشگاه */
  header: string;
  showTitle: boolean;
  showPrice: boolean;
  showCode: boolean;
  priceUnit: PriceUnit;
  /** اندازه‌ی قلم عنوان (pt) */
  titleSize: number;
  /** ارتفاع بارکد — درصد ارتفاع برچسب */
  barcodePct: number;
}

export const DEFAULT_LABEL: LabelConfig = {
  media: "roll",
  w: 50,
  h: 30,
  cols: 1,
  gapX: 0,
  gapY: 0,
  marginX: 0,
  marginTop: 0,
  header: "",
  showTitle: true,
  showPrice: true,
  showCode: true,
  priceUnit: "toman",
  titleSize: 8,
  barcodePct: 38,
};

export const LABEL_PRESETS: { key: string; label: string; cfg: Partial<LabelConfig> }[] = [
  { key: "50x30", label: "رول ۵۰×۳۰", cfg: { media: "roll", w: 50, h: 30, cols: 1, gapX: 0 } },
  { key: "2x50x30", label: "رول ۱۰۰ — دو تا ۵۰×۳۰", cfg: { media: "roll", w: 50, h: 30, cols: 2, gapX: 0 } },
  { key: "2x48x31", label: "رول ۱۰۰ — دو تا ۴۸×۳۱", cfg: { media: "roll", w: 48, h: 31, cols: 2, gapX: 4 } },
  { key: "40x25", label: "رول ۴۰×۲۵", cfg: { media: "roll", w: 40, h: 25, cols: 1, gapX: 0 } },
  { key: "60x40", label: "رول ۶۰×۴۰", cfg: { media: "roll", w: 60, h: 40, cols: 1, gapX: 0 } },
  { key: "a4", label: "برگه A4 — ۲۴تایی", cfg: { media: "a4", w: 70, h: 37, cols: 3, gapX: 0, gapY: 0, marginX: 0, marginTop: 0 } },
];

const num = (v: unknown, min: number, max: number, dflt: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 10) / 10)) : dflt;
};
const bool = (v: unknown, dflt: boolean) => (typeof v === "boolean" ? v : dflt);

/** ورودی ناشناخته ← تنظیم معتبر (مقدار خارج از بازه بریده می‌شود) */
export function normalizeLabelConfig(raw: unknown): LabelConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_LABEL;
  const media: LabelMedia = r.media === "a4" ? "a4" : "roll";
  const w = num(r.w, 10, 250, d.w);
  const cols = Math.round(num(r.cols, 1, 6, d.cols));
  const gapX = num(r.gapX, 0, 50, d.gapX);
  const marginX = num(r.marginX, 0, 50, d.marginX);
  const maxCols = Math.max(1, Math.floor(((media === "a4" ? 210 : 300) - 2 * marginX + gapX) / (w + gapX)));
  return {
    media,
    w,
    h: num(r.h, 10, 250, d.h),
    cols: Math.min(cols, maxCols),
    gapX,
    gapY: num(r.gapY, 0, 50, d.gapY),
    marginX,
    marginTop: num(r.marginTop, 0, 50, d.marginTop),
    header: String(r.header ?? "").slice(0, 40),
    showTitle: bool(r.showTitle, d.showTitle),
    showPrice: bool(r.showPrice, d.showPrice),
    showCode: bool(r.showCode, d.showCode),
    priceUnit: r.priceUnit === "rial" ? "rial" : "toman",
    titleSize: num(r.titleSize, 5, 16, d.titleSize),
    barcodePct: num(r.barcodePct, 20, 70, d.barcodePct),
  };
}

/** عرض صفحه‌ی چاپ — رول: مجموع برچسب‌ها و فاصله‌ها و حاشیه */
export const pageWidthOf = (c: LabelConfig) => (c.media === "a4" ? 210 : c.cols * c.w + (c.cols - 1) * c.gapX + 2 * c.marginX);

/** چند برچسب در هر صفحه */
export function perPageOf(c: LabelConfig): number {
  if (c.media === "roll") return c.cols;
  const rows = Math.max(1, Math.floor((297 - c.marginTop + c.gapY) / (c.h + c.gapY)));
  return rows * c.cols;
}
