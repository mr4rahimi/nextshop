/**
 * ROI تبلیغات — منطق خالص (بدون Prisma و DOM).
 * docs/features/tools.md بخش ۱۱
 *
 *   A  = هزینه‌ی تبلیغ
 *   S  = فروشی که تبلیغ آورد (مبلغ)
 *   G  = سود ناخالص همان فروش، **قبل از** کم کردن هزینه‌ی تبلیغ
 *        از مبلغ سود: «قبل از تبلیغ» → G = سود، «بعد از تبلیغ» → G = سود + A
 *        از حاشیه‌ی سود m: G = S·m
 *
 *   سود خالص تبلیغ  N = G − A
 *   ROI             N / A
 *   ROAS            S / A
 *   ROAS سربه‌سر     1 / (G/S)   ← کمتر از این، تبلیغ ضرر است
 *
 * ROAS بالا سود نیست: با حاشیه‌ی ۱۰٪، ROAS ۸ هنوز ضرر است. همین تفاوت دلیل این ابزار است.
 */

export type ProfitMode = "AMOUNT" | "MARGIN";
export type ProfitBasis = "BEFORE_AD" | "AFTER_AD";

export interface AdRoiInput {
  adCost: number;
  revenue: number;
  profitMode: ProfitMode;
  /** سود (تومان) در حالت AMOUNT */
  profit: number;
  /** سود واردشده قبل یا بعد از کم کردن هزینه‌ی تبلیغ است */
  profitBasis: ProfitBasis;
  /** حاشیه‌ی سود (درصد از فروش) در حالت MARGIN */
  marginPct: number;
  /** تعداد سفارش — اختیاری، ۰ یعنی ندارد */
  orders: number;
}

export interface AdRoiResult {
  /** سود ناخالص قبل از هزینه‌ی تبلیغ */
  gross: number;
  /** سود خالص تبلیغ (منفی = ضرر) */
  net: number;
  /** درصد؛ null اگر هزینه‌ی تبلیغ صفر باشد */
  roiPct: number | null;
  roas: number | null;
  /** حاشیه‌ی سود ناخالص (۰ تا ۱) */
  margin: number;
  /** کمترین ROAS بی‌ضرر؛ null اگر حاشیه صفر یا منفی باشد */
  breakEvenRoas: number | null;
  /** کمترین فروشی که هزینه‌ی تبلیغ را بپوشاند */
  breakEvenRevenue: number | null;
  /** هزینه‌ی جذب هر سفارش */
  cpa: number | null;
  /** سقف CPA = سود ناخالص هر سفارش */
  maxCpa: number | null;
  /** سود خالص هر سفارش بعد از سهم تبلیغ */
  netPerOrder: number | null;
}

export const DEFAULT_AD_ROI: AdRoiInput = {
  adCost: 0,
  revenue: 0,
  profitMode: "AMOUNT",
  profit: 0,
  profitBasis: "BEFORE_AD",
  marginPct: 30,
  orders: 0,
};

const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
const num = (n: number) => (Number.isFinite(n) ? n : 0);

export function calcAdRoi(input: AdRoiInput): AdRoiResult {
  const A = pos(input.adCost);
  const S = pos(input.revenue);
  // سود می‌تواند منفی باشد (فروش زیر قیمت)؛ حاشیه هم
  const gross =
    input.profitMode === "MARGIN"
      ? (S * Math.min(100, num(input.marginPct))) / 100
      : num(input.profit) + (input.profitBasis === "AFTER_AD" ? A : 0);
  const net = gross - A;
  const margin = S > 0 ? gross / S : 0;
  const Q = pos(input.orders);

  return {
    gross,
    net,
    roiPct: A > 0 ? (net / A) * 100 : null,
    roas: A > 0 ? S / A : null,
    margin,
    breakEvenRoas: margin > 0 ? 1 / margin : null,
    breakEvenRevenue: margin > 0 ? A / margin : null,
    cpa: Q > 0 ? A / Q : null,
    maxCpa: Q > 0 ? gross / Q : null,
    netPerOrder: Q > 0 ? net / Q : null,
  };
}
