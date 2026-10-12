/**
 * محاسبه‌ی نقطه‌ی سربه‌سر (تعداد) — منطق خالص (بدون Prisma و DOM).
 * docs/features/tools.md بخش ۱۰
 *
 * مدل یک دوره (پیش‌فرض ماهانه):
 *
 *   F  = جمع هزینه‌های ثابت دوره (اجاره، حقوق، تبلیغات ثابت، …)
 *   P  = قیمت فروش هر واحد
 *   V  = هزینه‌ی متغیر هر واحد (خرید، بسته‌بندی، ارسال، …)
 *   r  = هزینه‌ی درصدی از قیمت فروش (کارمزد بازار، درگاه، پورسانت)
 *
 *   حاشیه‌ی مشارکت هر واحد  cm = P·(1 − r) − V
 *   سربه‌سر (تعداد)          Q* = F / cm     ← همیشه به بالا گرد می‌شود
 *   سود با فروش Q            Q·cm − F
 *
 * اگر cm ≤ 0 هر فروش خودش زیان است و هیچ تعدادی هزینه‌ی ثابت را نمی‌پوشاند.
 */

export interface FixedCost {
  id: string;
  name: string;
  amount: number;
}

export interface BreakEvenInput {
  fixedCosts: FixedCost[];
  /** هزینه‌ی متغیر هر واحد (تومان) */
  variableCost: number;
  /** هزینه‌ی درصدی از قیمت فروش */
  variablePct: number;
  /** قیمت فروش هر واحد (تومان) */
  price: number;
  /** سود دلخواه دوره (تومان) — اختیاری، ۰ یعنی ندارد */
  targetProfit: number;
  /** فروش پیش‌بینی‌شده‌ی دوره (تعداد) — اختیاری، ۰ یعنی ندارد */
  expectedUnits: number;
  /** روزهای دوره، برای «روزانه چند تا» */
  periodDays: number;
}

export interface BreakEvenResult {
  fixedTotal: number;
  /** حاشیه‌ی مشارکت هر واحد */
  cm: number;
  /** نسبت حاشیه‌ی مشارکت به قیمت (۰ تا ۱) */
  cmRatio: number;
  /** null یعنی با این قیمت هر فروش زیان است */
  units: number | null;
  /** میانگین فروش روزانه برای رسیدن به سربه‌سر */
  unitsPerDay: number | null;
  /** مبلغ فروش در نقطه‌ی سربه‌سر (تعداد گرد شده × قیمت) */
  revenue: number | null;
  /** کمترین قیمتی که هر فروش زیان ندهد (بدون حساب هزینه‌ی ثابت) */
  minPrice: number | null;
  /** تعداد لازم برای سود دلخواه */
  targetUnits: number | null;
  /** سود/زیان دوره با فروش پیش‌بینی‌شده */
  expectedProfit: number | null;
  /** حاشیه‌ی ایمنی: فروش پیش‌بینی‌شده چند درصد بالاتر از سربه‌سر است (منفی = زیر آن) */
  safetyPct: number | null;
}

export const DEFAULT_FIXED_COSTS: FixedCost[] = [
  { id: "rent", name: "اجاره", amount: 0 },
  { id: "salary", name: "حقوق", amount: 0 },
  { id: "ads", name: "تبلیغات ثابت", amount: 0 },
  { id: "other", name: "سایر (قبوض، اینترنت، نرم‌افزار…)", amount: 0 },
];

export const DEFAULT_BREAK_EVEN: BreakEvenInput = {
  fixedCosts: DEFAULT_FIXED_COSTS,
  variableCost: 0,
  variablePct: 0,
  price: 0,
  targetProfit: 0,
  expectedUnits: 0,
  periodDays: 30,
};

const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

/** حاشیه‌ی مشارکت هر واحد */
export function contribution(price: number, variableCost: number, variablePct: number): number {
  return pos(price) * (1 - Math.min(100, pos(variablePct)) / 100) - pos(variableCost);
}

/** تعداد لازم برای پوشاندن `need` تومان؛ همیشه به بالا — با کمتر از آن به هدف نمی‌رسید */
export function unitsFor(need: number, cm: number): number | null {
  if (cm <= 0) return need <= 0 ? 0 : null;
  // ۱e-9 تا خطای ممیز شناور ۱۰۰٫۰۰۰۰۰۱ را ۱۰۱ نکند
  return Math.max(0, Math.ceil(need / cm - 1e-9));
}

export function calcBreakEven(input: BreakEvenInput): BreakEvenResult {
  const fixedTotal = input.fixedCosts.reduce((s, c) => s + pos(c.amount), 0);
  const P = pos(input.price);
  const r = Math.min(100, pos(input.variablePct)) / 100;
  const cm = contribution(P, input.variableCost, input.variablePct);
  const units = P > 0 ? unitsFor(fixedTotal, cm) : null;
  const days = pos(input.periodDays) || 30;
  const Q = pos(input.expectedUnits);

  return {
    fixedTotal,
    cm,
    cmRatio: P > 0 ? cm / P : 0,
    units,
    unitsPerDay: units === null ? null : units / days,
    revenue: units === null ? null : units * P,
    minPrice: r < 1 ? pos(input.variableCost) / (1 - r) : null,
    targetUnits: P > 0 && pos(input.targetProfit) > 0 ? unitsFor(fixedTotal + pos(input.targetProfit), cm) : null,
    expectedProfit: P > 0 && Q > 0 ? Q * cm - fixedTotal : null,
    safetyPct: P > 0 && Q > 0 && units !== null && units > 0 ? ((Q - units) / Q) * 100 : null,
  };
}

/** اگر قیمت چند درصد عوض شود سربه‌سر چه می‌شود — برای جدول «اگر قیمت…» */
export function priceSensitivity(input: BreakEvenInput, steps = [-10, -5, 5, 10]) {
  return steps.map((pct) => {
    const price = pos(input.price) * (1 + pct / 100);
    return { pct, price, units: calcBreakEven({ ...input, price }).units };
  });
}
