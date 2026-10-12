/**
 * تخفیف و حراج — منطق خالص (بدون Prisma و DOM).
 * docs/features/tools.md بخش ۱۳
 *
 * سود هر واحد همان حاشیه‌ی مشارکت سربه‌سر است (`contribution` در break-even.ts):
 *   پیش از تخفیف  u0 = P·(1−r) − C
 *   با تخفیف d     u1 = P·(1−d)·(1−r) − C
 *
 * برای اینکه سود کل با قبل برابر بماند باید فروش u0/u1 برابر شود؛ یعنی «فروش بیشتر لازم» = u0/u1 − 1.
 * بی‌هزینه‌ی درصدی همان فرمول آشنای m/(m−d) − 1 است (m حاشیه‌ی سود).
 *
 * حالت «حاشیه‌ی سود»: کاربر به‌جای هزینه درصد سود را می‌دهد؛ C = P·(1 − m) و r نادیده.
 */

import { contribution } from "./break-even";

export type CostMode = "AMOUNT" | "MARGIN";

export interface DiscountInput {
  price: number;
  costMode: CostMode;
  /** هزینه‌ی هر واحد (تومان) در حالت AMOUNT */
  unitCost: number;
  /** هزینه‌ی درصدی از فروش (کارمزد) در حالت AMOUNT */
  variablePct: number;
  /** حاشیه‌ی سود (درصد) در حالت MARGIN */
  marginPct: number;
  /** تخفیف (درصد) */
  discountPct: number;
  /** فروش فعلی در دوره (تعداد) — اختیاری */
  currentUnits: number;
}

export interface DiscountRow {
  discountPct: number;
  newPrice: number;
  /** سود هر واحد با تخفیف */
  unitProfit: number;
  /** null یعنی با این تخفیف هر فروش ضرر است */
  extraSalesPct: number | null;
  /** تعداد لازم برای همان سود کل؛ null بدون فروش فعلی یا با ضرر */
  unitsNeeded: number | null;
}

export interface DiscountResult extends DiscountRow {
  /** سود هر واحد پیش از تخفیف */
  baseProfit: number;
  /** حاشیه‌ی سود پیش از تخفیف (۰ تا ۱) */
  baseMargin: number;
  /** بیشترین تخفیف تا سود صفر (درصد) */
  maxDiscountPct: number;
  /** سود دوره پیش از تخفیف با فروش فعلی */
  baseTotal: number | null;
  /** سود دوره با تخفیف اگر فروش بیشتر نشود */
  sameUnitsTotal: number | null;
}

export const DEFAULT_DISCOUNT: DiscountInput = {
  price: 0,
  costMode: "AMOUNT",
  unitCost: 0,
  variablePct: 0,
  marginPct: 30,
  discountPct: 10,
  currentUnits: 0,
};

export const DISCOUNT_STEPS = [5, 10, 15, 20, 25, 30];

const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

function unitProfit(input: DiscountInput, price: number): number {
  if (input.costMode === "MARGIN") {
    const cost = pos(input.price) * (1 - Math.min(100, pos(input.marginPct)) / 100);
    return contribution(price, cost, 0);
  }
  return contribution(price, input.unitCost, input.variablePct);
}

export function discountRow(input: DiscountInput, discountPct: number): DiscountRow {
  const P = pos(input.price);
  const d = Math.min(100, pos(discountPct));
  const newPrice = P * (1 - d / 100);
  const u0 = unitProfit(input, P);
  const u1 = unitProfit(input, newPrice);
  const ok = u0 > 0 && u1 > 0;
  const Q = pos(input.currentUnits);
  return {
    discountPct: d,
    newPrice,
    unitProfit: u1,
    extraSalesPct: ok ? (u0 / u1 - 1) * 100 : null,
    // ۱e-9 تا خطای ممیز شناور یک واحد اضافه نکند
    unitsNeeded: ok && Q > 0 ? Math.ceil((Q * u0) / u1 - 1e-9) : null,
  };
}

export function calcDiscount(input: DiscountInput): DiscountResult {
  const P = pos(input.price);
  const baseProfit = unitProfit(input, P);
  // سود با قیمت خطی است: u(x) = x·k − C ⇒ تخفیف تا سود صفر = u0 / (P·k) = u0 / (u0 + C)
  const atZero = unitProfit(input, 0); // = −C
  const maxDiscountPct = P > 0 && baseProfit > 0 ? (baseProfit / (baseProfit - atZero)) * 100 : 0;
  const Q = pos(input.currentUnits);
  const row = discountRow(input, input.discountPct);
  return {
    ...row,
    baseProfit,
    baseMargin: P > 0 ? baseProfit / P : 0,
    maxDiscountPct,
    baseTotal: Q > 0 ? Q * baseProfit : null,
    sameUnitsTotal: Q > 0 ? Q * row.unitProfit : null,
  };
}
