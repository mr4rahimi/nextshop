/**
 * مقایسه‌ی محصولات — شاخص‌های مشتق و «بهترین هر ردیف» (خالص، بدون Prisma و DOM).
 * داده را `lib/tools/compare-data.ts` می‌خواند. docs/features/tools.md بخش ۲۱
 */

export interface ChannelSales {
  /** "site" | "staff" | کد بازارگاه */
  code: string;
  label: string;
  qty: number;
  revenue: number;
}

export interface CompareRaw {
  id: string;
  title: string;
  slug: string;
  image: string | null;
  isActive: boolean;
  hasVariants: boolean;
  /** قیمت مؤثر فعلی (ویژه اگر هست) */
  price: number;
  /** قیمت پیش از تخفیف ویژه */
  listPrice: number;
  stock: number;
  ratingAvg: number;
  ratingCount: number;
  channels: ChannelSales[];
  /** سفارش آنلاین سایت (نه تلفنی) که این محصول را داشت */
  onlineOrders: number;
  /** بهای فروش‌های بازه: ثبت‌شده روی سفارش + بقیه با میانگین فعلی؛ null اگر بخشی بی‌بها ماند */
  costOfSales: number | null;
  /** چند واحد از فروش سایت بهای ثبت‌شده داشت */
  costKnownQty: number;
  /** بهای میانگین فعلی واحد (حسابداری)؛ null اگر نیست */
  unitCost: number | null;
  /** بازدید صفحه‌ی محصول در بازه؛ null یعنی آمار بازدید وصل نیست */
  views: number | null;
  /** فروش هفتگی (تعداد، همه‌ی کانال‌ها) از قدیم به جدید */
  weekly: number[];
}

export interface CompareRow extends CompareRaw {
  qty: number;
  revenue: number;
  profit: number | null;
  /** حاشیه‌ی سود (۰ تا ۱) */
  margin: number | null;
  /** سود هر واحد با قیمت و بهای فعلی */
  unitProfitNow: number | null;
  dailyQty: number;
  /** موجودی چند روز فروش است */
  coverage: number | null;
  /** سفارش آنلاین ÷ بازدید */
  conversion: number | null;
}

export function deriveCompare(raw: CompareRaw, days: number): CompareRow {
  const qty = raw.channels.reduce((s, c) => s + c.qty, 0);
  const revenue = raw.channels.reduce((s, c) => s + c.revenue, 0);
  const profit = raw.costOfSales === null ? null : revenue - raw.costOfSales;
  const dailyQty = qty / Math.max(1, days);
  return {
    ...raw,
    qty,
    revenue,
    profit,
    margin: profit !== null && revenue > 0 ? profit / revenue : null,
    unitProfitNow: raw.unitCost === null ? null : raw.price - raw.unitCost,
    dailyQty,
    coverage: raw.stock <= 0 ? 0 : dailyQty > 0 ? raw.stock / dailyQty : null,
    conversion: raw.views !== null && raw.views > 0 ? raw.onlineOrders / raw.views : null,
  };
}

/**
 * اندیس بهترین مقدار یک ردیف — `higher` بزرگ‌تر بهتر است. با کمتر از دو مقدار معتبر یا برابری همه
 * null برمی‌گردد (برجسته کردن بی‌معنی است).
 */
export function bestIndex(values: (number | null)[], higher = true): number | null {
  let best: number | null = null;
  let valid = 0;
  values.forEach((v, i) => {
    if (v === null || !Number.isFinite(v)) return;
    valid++;
    if (best === null || (higher ? v > values[best]! : v < values[best]!)) best = i;
  });
  if (valid < 2 || best === null) return null;
  const top = values[best]!;
  return values.every((v) => v === null || v === top) ? null : best;
}

/** کلید مسیر صفحه‌ی محصول برای تطبیق با آمار بازدید: بی‌پرس‌وجو، بی‌اسلش آخر، رمزگشایی‌شده */
export function normalizePath(p: string): string {
  let x = p.split("?")[0].split("#")[0];
  try {
    x = decodeURIComponent(x);
  } catch {}
  return x.length > 1 ? x.replace(/\/+$/, "") : x;
}

/** شماره‌ی هفته از شروع بازه (۰ = هفته‌ی اول) */
export function weekIndex(at: number, start: number, weeks: number): number {
  return Math.min(weeks - 1, Math.max(0, Math.floor((at - start) / (7 * 86_400_000))));
}
