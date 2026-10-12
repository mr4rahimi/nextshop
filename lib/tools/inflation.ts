/**
 * قیمت‌گذاری با تورم (قیمت جایگزینی) — منطق خالص (بدون Prisma و DOM).
 * docs/features/tools.md بخش ۱۶
 *
 * کالایی که با قیمت خرید قدیم C0 خریده شده و امروز خرید دوباره‌اش C1 است:
 *   سهم فروشنده از قیمت P    k·P      (k = 1 − r، r هزینه‌ی درصدی از فروش)
 *   سود روی کاغذ              k·P − C0
 *   سود واقعی                 k·P − C1   ← اگر منفی باشد سرمایه کوچک می‌شود
 *   قیمت حفظ سرمایه           C1 / k
 *   قیمت با سود دلخواه m      C1 / (k − m)      (m درصد از قیمت فروش)
 * C1 یا مستقیم وارد می‌شود یا از تورم ماهانه i و ماه‌های ماندن t: C0·(1+i)^t.
 */

export type ReplaceMode = "KNOWN" | "RATE";

export interface InflationInput {
  oldCost: number;
  mode: ReplaceMode;
  /** قیمت خرید امروز (KNOWN) */
  newCost: number;
  /** تورم ماهانه (درصد) و چند ماه کالا می‌ماند (RATE) */
  monthlyPct: number;
  months: number;
  /** قیمت فروش فعلی */
  price: number;
  /** هزینه‌ی درصدی از فروش (کارمزد) */
  variablePct: number;
  /** سود دلخواه (درصد از قیمت فروش) */
  targetMarginPct: number;
}

export interface InflationResult {
  replacement: number;
  paperProfit: number;
  realProfit: number;
  /** درصد از قیمت فروش؛ null بی‌قیمت */
  paperMargin: number | null;
  realMargin: number | null;
  /** با پول فروش ۱۰ واحد امروز چند واحد می‌شود خرید */
  rebuyOf10: number | null;
  /** کمترین قیمت که سرمایه کوچک نشود؛ null اگر کارمزد ۱۰۰٪ باشد */
  keepPrice: number | null;
  /** قیمت با سود دلخواه روی قیمت جایگزینی؛ null اگر ممکن نباشد */
  targetPrice: number | null;
}

export const DEFAULT_INFLATION: InflationInput = {
  oldCost: 0,
  mode: "KNOWN",
  newCost: 0,
  monthlyPct: 3,
  months: 3,
  price: 0,
  variablePct: 0,
  targetMarginPct: 20,
};

const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function replacementCost(input: Pick<InflationInput, "oldCost" | "mode" | "newCost" | "monthlyPct" | "months">): number {
  if (input.mode === "KNOWN") return pos(input.newCost);
  return pos(input.oldCost) * Math.pow(1 + pos(input.monthlyPct) / 100, pos(input.months));
}

export function calcInflation(input: InflationInput): InflationResult {
  const C0 = pos(input.oldCost);
  const C1 = replacementCost(input);
  const P = pos(input.price);
  const k = 1 - Math.min(100, pos(input.variablePct)) / 100;
  const m = Math.min(99, pos(input.targetMarginPct)) / 100;
  const net = k * P;
  return {
    replacement: C1,
    paperProfit: net - C0,
    realProfit: net - C1,
    paperMargin: P > 0 ? (net - C0) / P : null,
    realMargin: P > 0 ? (net - C1) / P : null,
    rebuyOf10: P > 0 && C1 > 0 ? (10 * net) / C1 : null,
    keepPrice: k > 0 ? C1 / k : null,
    targetPrice: k - m > 0 ? C1 / (k - m) : null,
  };
}
