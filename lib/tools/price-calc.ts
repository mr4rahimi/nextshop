/**
 * ماشین‌حساب قیمت و سود — منطق خالص (بدون Prisma و DOM).
 * docs/features/tools.md بخش ۸
 *
 * مدل یک واحد کالا روی یک کانال فروش:
 *
 *   P  = قیمت فروش به مشتری (با مالیات، اگر روشن باشد)
 *   C  = بهای تمام‌شده‌ی واحد = خرید + هزینه‌های جانبی + هزینه‌ی ارسالی که فروشنده می‌دهد
 *   F  = کارمزد ثابت کانال برای هر فروش
 *   k  = 1/(1+v) − (c + g)    ← سهم فروشنده از هر تومان قیمت
 *        v نرخ مالیات (قیمت شامل مالیات است و سهم مالیات به دولت می‌رود)
 *        c کارمزد درصدی کانال، g کارمزد درگاه — هر دو روی قیمت کامل
 *
 *   سود = k·P − F − C
 *
 * ⚠️ کارمزد بازارها و نرخ مالیات در کد ثابت نیست — هر فروشگاه قرارداد خودش را دارد
 * و نرخ‌ها عوض می‌شوند؛ کاربر وارد می‌کند و در مرورگرش می‌ماند.
 */

export interface Channel {
  id: string;
  name: string;
  /** کارمزد درصدی کانال روی قیمت فروش */
  commissionPct: number;
  /** کارمزد ثابت هر فروش (تومان) */
  commissionFixed: number;
  /** کارمزد درگاه پرداخت (درصد) */
  gatewayPct: number;
  /** هزینه‌ی ارسالی که فروشنده برای هر واحد می‌پردازد (تومان) */
  shippingCost: number;
}

export type TargetMode = "MARGIN" | "MARKUP" | "AMOUNT";
export type Rounding = "NONE" | "R1000" | "R10000" | "R100000" | "END900";

export interface CalcInput {
  /** قیمت خرید واحد */
  cost: number;
  /** هزینه‌های جانبی واحد: حمل تا انبار، بسته‌بندی، … */
  extraCost: number;
  vatEnabled: boolean;
  vatPct: number;
  mode: "TARGET" | "PRICE";
  targetMode: TargetMode;
  /** درصد (برای MARGIN و MARKUP) یا تومان (برای AMOUNT) */
  targetValue: number;
  /** قیمت فروش داده‌شده در حالت PRICE */
  price: number;
  rounding: Rounding;
  /** حداقل سودی که تخفیف نباید از آن پایین‌تر ببرد (تومان) */
  minProfit: number;
}

export interface ChannelResult {
  channel: Channel;
  /** قیمت لازم پیش از گرد کردن؛ `null` یعنی با این کارمزدها رسیدن به هدف ممکن نیست */
  rawPrice: number | null;
  price: number | null;
  profit: number;
  /** سود ÷ قیمت فروش (٪) */
  marginPct: number;
  /** سود ÷ بهای تمام‌شده (٪) */
  markupPct: number;
  breakEven: number | null;
  /** بیشترین تخفیف روی همین قیمت که سود را زیر `minProfit` نمی‌برد (٪) */
  maxDiscountPct: number;
  /** ریز مبالغ روی همین قیمت */
  vat: number;
  commission: number;
  gateway: number;
  unitCost: number;
  /** ضریب سهم فروشنده — زیر صفر یعنی کارمزدها از کل قیمت بیشترند */
  k: number;
}

const pct = (n: number) => (Number.isFinite(n) ? n / 100 : 0);
const num = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function roundPrice(p: number, r: Rounding): number {
  if (!Number.isFinite(p) || p <= 0) return 0;
  switch (r) {
    case "R1000":
      return Math.ceil(p / 1_000) * 1_000;
    case "R10000":
      return Math.ceil(p / 10_000) * 10_000;
    case "R100000":
      return Math.ceil(p / 100_000) * 100_000;
    case "END900": {
      // کوچک‌ترین عدد ≥ p که به ۹۰۰ ختم شود: ۱۲۴۳۱۰ ← ۱۲۴۹۰۰، ۱۲۴۹۵۰ ← ۱۲۵۹۰۰
      const up = Math.ceil((p + 100) / 1_000) * 1_000 - 100;
      return up;
    }
    default:
      return Math.ceil(p);
  }
}

export function calcChannel(input: CalcInput, ch: Channel): ChannelResult {
  const v = input.vatEnabled ? pct(num(input.vatPct)) : 0;
  const c = pct(num(ch.commissionPct));
  const g = pct(num(ch.gatewayPct));
  const F = num(ch.commissionFixed);
  const C = num(input.cost) + num(input.extraCost) + num(ch.shippingCost);
  const k = 1 / (1 + v) - (c + g);

  let raw: number | null;
  if (input.mode === "PRICE") {
    raw = num(input.price);
  } else if (k <= 0) {
    raw = null;
  } else if (input.targetMode === "MARGIN") {
    const m = pct(input.targetValue);
    raw = k - m > 0 ? (F + C) / (k - m) : null;
  } else if (input.targetMode === "MARKUP") {
    raw = (C * (1 + pct(input.targetValue)) + F) / k;
  } else {
    raw = (num(input.targetValue) + F + C) / k;
  }

  const price = raw === null ? null : input.mode === "PRICE" ? raw : roundPrice(raw, input.rounding);
  const P = price ?? 0;
  const profit = k * P - F - C;
  const breakEven = k > 0 ? (F + C) / k : null;
  const floorPrice = k > 0 ? (num(input.minProfit) + F + C) / k : null;
  const maxDiscountPct = P > 0 && floorPrice !== null && floorPrice < P ? (1 - floorPrice / P) * 100 : 0;

  return {
    channel: ch,
    rawPrice: raw,
    price,
    profit: P > 0 ? profit : 0,
    marginPct: P > 0 ? (profit / P) * 100 : 0,
    markupPct: P > 0 && C > 0 ? (profit / C) * 100 : 0,
    breakEven,
    maxDiscountPct,
    vat: P - P / (1 + v),
    commission: P * c + F,
    gateway: P * g,
    unitCost: C,
    k,
  };
}

export const DEFAULT_CHANNEL: Channel = {
  id: "site",
  name: "سایت خودم",
  commissionPct: 0,
  commissionFixed: 0,
  gatewayPct: 0,
  shippingCost: 0,
};

export const DEFAULT_INPUT: CalcInput = {
  cost: 0,
  extraCost: 0,
  vatEnabled: false,
  vatPct: 10,
  mode: "TARGET",
  targetMode: "MARGIN",
  targetValue: 20,
  price: 0,
  rounding: "R10000",
  minProfit: 0,
};
