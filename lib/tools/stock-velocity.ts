/**
 * سرعت فروش کالا — منطق خالص مشترک «موجودی و نقطه‌ی سفارش» و «سرمایه‌ی درگیر در موجودی»
 * (بدون Prisma و DOM). داده را `lib/tools/stock-data.ts` از کاردکس می‌خواند؛ حالت دستی همین
 * توابع را با عدد کاربر صدا می‌زند. docs/features/tools.md بخش ۱۴ و ۱۵
 *
 *   فروش روزانه        d = فروش خالص بازه ÷ روزهای «موجود بودن» در بازه
 *                      روزهای ناموجود از مخرج کم می‌شوند، وگرنه کالای پرفروشی که نصف ماه تمام
 *                      بوده کم‌فروش دیده می‌شد. کمینه‌ی مخرج ۷ روز (یا کل بازه اگر کوتاه‌تر است)
 *                      تا کالای تازه‌رسیده با دو فروش، «پرفروش» حساب نشود.
 *   روزهای پوشش       qty ÷ d
 *   نقطه‌ی سفارش      ceil(d × (زمان رسیدن + روزهای ذخیره))
 *   روز تا سفارش      (qty − نقطه‌ی سفارش) ÷ d       ≤ ۰ یعنی همین امروز
 *   مقدار سفارش       ceil(d × (زمان رسیدن + ذخیره + روزهای پوشش سفارش) − qty)
 *   سرمایه‌ی خوابیده   max(0, qty − d × روزهای نیاز) × بهای واحد
 */

export interface VelocityRow {
  id: string;
  title: string;
  code: string;
  image: string | null;
  /** موجودی فعلی (در انبار انتخابی) */
  qty: number;
  /** فروش خالص بازه (فروش − برگشت از فروش) */
  sold: number;
  /** روزهایی از بازه که موجودی کل مثبت بود */
  inStockDays: number;
  /** آخرین روز فروش (YYYY-MM-DD) در کل کاردکس */
  lastSale: string | null;
  /** نقطه‌ی سفارش ثبت‌شده روی کالا */
  reorderPoint: number | null;
  /** بهای میانگین واحد — فقط با مجوز دیدن بها */
  unitCost?: number;
  /** قیمت فروش (محصول سایت یا قیمت کالا) */
  price: number | null;
}

export interface ReorderSettings {
  /** زمان رسیدن کالا از سفارش تا انبار (روز) */
  leadDays: number;
  /** ذخیره‌ی اطمینان (روز) */
  safetyDays: number;
  /** هر سفارش چند روز فروش را بپوشاند */
  coverDays: number;
}

export const DEFAULT_REORDER: ReorderSettings = { leadDays: 7, safetyDays: 3, coverDays: 30 };

export type StockClass = "FAST" | "SLOW" | "STALE" | "DEAD" | "OUT";

export interface ClassSettings {
  /** روز پوشش کمتر از این → پرفروش */
  fastDays: number;
  /** روز پوشش بیشتر از این → راکد */
  staleDays: number;
  /** موجودی بیش از نیاز این‌همه روز «سرمایه‌ی خوابیده» است */
  needDays: number;
}

export const DEFAULT_CLASS: ClassSettings = { fastDays: 30, staleDays: 120, needDays: 60 };

export const CLASS_LABEL: Record<StockClass, string> = {
  FAST: "پرفروش",
  SLOW: "کم‌گردش",
  STALE: "راکد",
  DEAD: "بی‌فروش",
  OUT: "ناموجود",
};

const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function dailySales(sold: number, inStockDays: number, windowDays: number): number {
  const s = pos(sold);
  if (s === 0) return 0;
  const w = Math.max(1, pos(windowDays));
  const days = Math.min(w, Math.max(pos(inStockDays), Math.min(7, w)));
  return s / days;
}

/** null یعنی فروشی نیست و موجودی هرگز تمام نمی‌شود */
export function coverageDays(qty: number, daily: number): number | null {
  if (qty <= 0) return 0;
  return daily > 0 ? qty / daily : null;
}

export interface ReorderResult {
  daily: number;
  coverage: number | null;
  reorderPoint: number;
  /** null یعنی فروشی نیست؛ ≤ ۰ یعنی همین امروز سفارش بدهید */
  daysToOrder: number | null;
  orderQty: number;
}

export function reorder(qty: number, daily: number, s: ReorderSettings): ReorderResult {
  const lead = pos(s.leadDays) + pos(s.safetyDays);
  const rp = Math.ceil(daily * lead - 1e-9);
  return {
    daily,
    coverage: coverageDays(qty, daily),
    reorderPoint: rp,
    daysToOrder: daily > 0 ? (qty - rp) / daily : null,
    orderQty: daily > 0 ? Math.max(0, Math.ceil(daily * (lead + pos(s.coverDays)) - qty - 1e-9)) : 0,
  };
}

export function classify(qty: number, sold: number, coverage: number | null, s: ClassSettings): StockClass {
  if (qty <= 0) return "OUT";
  if (pos(sold) === 0 || coverage === null) return "DEAD";
  if (coverage < s.fastDays) return "FAST";
  if (coverage <= s.staleDays) return "SLOW";
  return "STALE";
}

/** تعداد بیش از نیاز `needDays` روز — همان که سرمایه را قفل کرده */
export function excessQty(qty: number, daily: number, needDays: number): number {
  return Math.max(0, qty - daily * pos(needDays));
}

export interface CapitalRow {
  row: VelocityRow;
  daily: number;
  coverage: number | null;
  cls: StockClass;
  value: number;
  /** ارزش بیش از نیاز */
  locked: number;
}

export function capitalRows(rows: VelocityRow[], windowDays: number, s: ClassSettings): CapitalRow[] {
  return rows.map((row) => {
    const daily = dailySales(row.sold, row.inStockDays, windowDays);
    const coverage = coverageDays(row.qty, daily);
    const cost = pos(row.unitCost ?? 0);
    const q = Math.max(0, row.qty);
    return {
      row,
      daily,
      coverage,
      cls: classify(row.qty, row.sold, coverage, s),
      value: q * cost,
      locked: excessQty(q, daily, s.needDays) * cost,
    };
  });
}

/**
 * روزهای موجود بودن در بازه از روی مانده‌ی پس از هر حرکت (کاردکس سراسری).
 * `before` مانده‌ی پیش از شروع بازه؛ `moves` حرکت‌های بازه به ترتیب زمان با شماره‌ی روز (۰ = اولین روز بازه).
 * روزی «موجود» است که مانده‌ی پایان آن روز مثبت باشد.
 */
export function inStockDays(before: number, moves: { day: number; balance: number }[], windowDays: number): number {
  let bal = before;
  let k = 0;
  let count = 0;
  for (let day = 0; day < windowDays; day++) {
    while (k < moves.length && moves[k].day <= day) bal = moves[k++].balance;
    if (bal > 0) count++;
  }
  return count;
}
