/**
 * ارزش طول عمر مشتری (LTV) — منطق خالص (بدون Prisma و DOM).
 * docs/features/tools.md بخش ۱۹
 *
 *   LTV فروش  = میانگین خرید × خرید در سال × سال‌های ماندن
 *   LTV سود   = LTV فروش × حاشیه‌ی سود
 *   سقف هزینه‌ی جذب = LTV سود × سهم مجاز (پیش‌فرض یک‌سوم — قاعده‌ی رایج LTV:CAC = ۳:۱)
 * با هزینه‌ی جذب فعلی: نسبت LTV:CAC و چند ماه طول می‌کشد تا هزینه‌ی جذب برگردد.
 */

export interface LtvInput {
  avgOrder: number;
  ordersPerYear: number;
  years: number;
  marginPct: number;
  /** چه سهمی از LTV سود را حاضرید خرج جذب کنید (درصد) */
  cacSharePct: number;
  /** هزینه‌ی جذب فعلی هر مشتری — اختیاری */
  currentCac: number;
}

export interface LtvResult {
  ltvRevenue: number;
  ltvProfit: number;
  maxCac: number;
  /** سود سالانه‌ی هر مشتری */
  yearlyProfit: number;
  /** LTV سود ÷ هزینه‌ی جذب فعلی */
  ratio: number | null;
  /** ماه تا برگشت هزینه‌ی جذب؛ null بی‌هزینه یا بی‌سود */
  paybackMonths: number | null;
}

export const DEFAULT_LTV: LtvInput = {
  avgOrder: 0,
  ordersPerYear: 3,
  years: 2,
  marginPct: 25,
  cacSharePct: 33,
  currentCac: 0,
};

const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function calcLtv(input: LtvInput): LtvResult {
  const ltvRevenue = pos(input.avgOrder) * pos(input.ordersPerYear) * pos(input.years);
  const m = Math.min(100, pos(input.marginPct)) / 100;
  const ltvProfit = ltvRevenue * m;
  const yearlyProfit = pos(input.avgOrder) * pos(input.ordersPerYear) * m;
  const cac = pos(input.currentCac);
  return {
    ltvRevenue,
    ltvProfit,
    maxCac: ltvProfit * (Math.min(100, pos(input.cacSharePct)) / 100),
    yearlyProfit,
    ratio: cac > 0 ? ltvProfit / cac : null,
    paybackMonths: cac > 0 && yearlyProfit > 0 ? cac / (yearlyProfit / 12) : null,
  };
}
