/**
 * حداقل خرید برای ارسال رایگان — منطق خالص (بدون Prisma و DOM).
 * docs/features/tools.md بخش ۱۷
 *
 *   A  میانگین مبلغ سبد امروز (مشتری هزینه‌ی ارسال را جدا می‌دهد)
 *   S  هزینه‌ی ارسالی که با «ارسال رایگان» فروشگاه می‌پردازد
 *   m  حاشیه‌ی سود فروش
 *
 * مشتری‌ای که برای ارسال رایگان سبدش را از A به T می‌رساند، سود را از A·m به T·m − S می‌برد؛
 * پس آستانه‌ی سربه‌سر T* = A + S/m. پیشنهاد: بیشترِ T* و ۱٫۲۵ برابر میانگین سبد (کمتر از آن، تقریباً
 * همه‌ی سفارش‌ها رایگان می‌شوند)، گرد به بالا.
 *
 * هزینه‌ی پنهان: سفارش‌هایی که همین حالا بالای آستانه‌اند هم ارسال رایگان می‌گیرند و سودی اضافه
 * نمی‌آورند — `alreadyAbovePct` درصد این سفارش‌ها و `ordersPerMonth` تعداد کل.
 */

export interface FreeShippingInput {
  avgOrder: number;
  shippingCost: number;
  marginPct: number;
  /** آستانه‌ای که کاربر در نظر دارد — ۰ یعنی همان پیشنهادی */
  threshold: number;
  /** سفارش ماهانه — اختیاری */
  ordersPerMonth: number;
  /** چند درصد سفارش‌ها همین حالا بالای آستانه‌اند — اختیاری */
  alreadyAbovePct: number;
}

export interface FreeShippingResult {
  /** آستانه‌ی سربه‌سر؛ null بی‌حاشیه‌ی سود */
  breakEven: number | null;
  suggested: number | null;
  /** آستانه‌ای که حساب‌ها رویش انجام شد */
  threshold: number;
  /** سود سفارشی که دقیقاً به آستانه رسیده، بعد از ارسال */
  profitAtThreshold: number;
  /** سود میانگین سفارش امروز (ارسال با مشتری) */
  profitNow: number;
  /** سود اضافه‌ی هر مشتری که سبدش را به آستانه می‌رساند (منفی = ضرر) */
  gainPerUpgrade: number;
  /** هزینه‌ی ماهانه‌ی ارسال رایگان برای سفارش‌هایی که از قبل بالای آستانه بودند */
  giveawayMonthly: number | null;
  /** چند مشتری در ماه باید سبدشان را به آستانه برسانند تا آن هزینه جبران شود */
  upgradesNeeded: number | null;
}

export const DEFAULT_FREE_SHIPPING: FreeShippingInput = {
  avgOrder: 0,
  shippingCost: 0,
  marginPct: 25,
  threshold: 0,
  ordersPerMonth: 0,
  alreadyAbovePct: 0,
};

const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

/** گرد به بالا به پله‌ی خوانا: زیر ۱ میلیون ۵۰ هزار، بالاتر ۱۰۰ هزار */
export function niceCeil(n: number): number {
  const step = n < 1_000_000 ? 50_000 : 100_000;
  return Math.ceil(n / step - 1e-9) * step;
}

export function calcFreeShipping(input: FreeShippingInput): FreeShippingResult {
  const A = pos(input.avgOrder);
  const S = pos(input.shippingCost);
  const m = Math.min(100, pos(input.marginPct)) / 100;
  const breakEven = m > 0 && A > 0 ? A + S / m : null;
  const suggested = breakEven === null ? null : niceCeil(Math.max(breakEven, A * 1.25));
  const T = pos(input.threshold) || suggested || 0;
  const profitNow = A * m;
  const profitAtThreshold = T * m - S;
  const gainPerUpgrade = profitAtThreshold - profitNow;
  const n = pos(input.ordersPerMonth);
  const giveawayMonthly = n > 0 ? n * (Math.min(100, pos(input.alreadyAbovePct)) / 100) * S : null;
  return {
    breakEven,
    suggested,
    threshold: T,
    profitAtThreshold,
    profitNow,
    gainPerUpgrade,
    giveawayMonthly,
    upgradesNeeded: giveawayMonthly !== null && giveawayMonthly > 0 && gainPerUpgrade > 0 ? Math.ceil(giveawayMonthly / gainPerUpgrade - 1e-9) : null,
  };
}
