/**
 * فروش اقساطی — قیمت قسطی، جدول اقساط و ارزش امروزِ آن با تورم. منطق خالص (بدون Prisma و DOM).
 * docs/features/tools.md بخش ۱۸
 *
 * کارمزد و جدول با همان قواعد برنامه‌ی اقساط حسابداری است (`lib/accounting/installments-calc.ts`:
 * `calcFee` ساده نه مرکب، باقی‌مانده روی قسط آخر) تا عدد این ابزار با فاکتور قسطی یکی باشد.
 *
 * ارزش امروز با تورم ماهانه‌ی i: هر قسط ÷ (1+i)^(ماه سررسید)؛ قسط اول یک «فاصله» بعد از امروز.
 * «کمترین کارمزد ماهانه» = درصدی که ارزش امروزِ کل (پیش‌پرداخت + اقساط) با قیمت نقدی برابر شود —
 * با جستجوی دودویی روی همان `calcFee`.
 */

import { addJalaliMonths, buildSchedule, calcFee, type FeeMode } from "@/lib/accounting/installments-calc";

export type DownMode = "AMOUNT" | "PCT";

export interface InstallmentInput {
  cashPrice: number;
  downMode: DownMode;
  /** پیش‌پرداخت: مبلغ یا درصد */
  down: number;
  count: number;
  intervalMonths: number;
  feeMode: FeeMode;
  /** درصد کارمزد (ماهانه یا کل دوره) */
  feePct: number;
  /** کارمزد ثابت (تومان) */
  feeFixed: number;
  /** تورم یا هزینه‌ی پول ماهانه (درصد) — اختیاری */
  inflationPct: number;
  /** گرد کردن قسط */
  roundTo: number;
}

export interface InstallmentRow {
  seq: number;
  dueDate: Date;
  /** ماه سررسید از امروز */
  month: number;
  amount: number;
  /** ارزش امروز */
  pv: number;
}

export interface InstallmentResult {
  downAmount: number;
  principal: number;
  fee: number;
  /** جمع اقساط */
  installmentsTotal: number;
  /** قیمت کل قسطی = پیش‌پرداخت + اقساط */
  totalPrice: number;
  /** افزایش نسبت به نقدی (درصد) */
  markupPct: number;
  rows: InstallmentRow[];
  /** ارزش امروز کل (پیش‌پرداخت + اقساط) */
  presentValue: number;
  /** ارزش امروز منهای قیمت نقدی؛ منفی = قسطی واقعاً ارزان‌تر از نقدی است */
  realGain: number;
  /** کمترین کارمزد ماهانه (درصد) که قسطی با نقدی برابر شود؛ null بی‌تورم یا بی‌اقساط */
  breakEvenMonthlyPct: number | null;
}

export const DEFAULT_INSTALLMENT: InstallmentInput = {
  cashPrice: 0,
  downMode: "PCT",
  down: 30,
  count: 6,
  intervalMonths: 1,
  feeMode: "MONTHLY",
  feePct: 3,
  feeFixed: 0,
  inflationPct: 3,
  roundTo: 10_000,
};

const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

function presentValueOf(input: InstallmentInput, feeMode: FeeMode, feePct: number, firstDue: Date) {
  const cash = Math.round(pos(input.cashPrice));
  const down = Math.min(cash, Math.round(input.downMode === "PCT" ? (cash * Math.min(100, pos(input.down))) / 100 : pos(input.down)));
  const principal = cash - down;
  const count = Math.max(1, Math.min(120, Math.round(pos(input.count)) || 1));
  const interval = Math.max(1, Math.min(12, Math.round(pos(input.intervalMonths)) || 1));
  const fee = Number(calcFee(BigInt(principal), feeMode, Math.round(pos(feePct) * 100), count, interval, BigInt(Math.round(pos(input.feeFixed)))));
  const total = principal + fee;
  const sched = principal > 0 ? buildSchedule({ total: BigInt(total), count, firstDue, intervalMonths: interval, roundTo: BigInt(Math.max(1, Math.round(pos(input.roundTo)) || 1)) }) : [];
  const i = pos(input.inflationPct) / 100;
  const rows: InstallmentRow[] = sched.map((r, k) => {
    const month = (k + 1) * interval;
    const amount = Number(r.amount);
    return { seq: r.seq, dueDate: r.dueDate, month, amount, pv: amount / Math.pow(1 + i, month) };
  });
  return { cash, down, principal, fee, total, rows, pv: down + rows.reduce((s, r) => s + r.pv, 0) };
}

/** `today` روز تهران (`todayKey`)؛ سررسید قسط k = امروز + k × فاصله، با ماه شمسی مثل برنامه‌ی اقساط */
export function calcInstallments(input: InstallmentInput, today: Date): InstallmentResult {
  const interval = Math.max(1, Math.min(12, Math.round(pos(input.intervalMonths)) || 1));
  const base = addJalaliMonths(today, interval);
  const x = presentValueOf(input, input.feeMode, input.feePct, base);
  let breakEvenMonthlyPct: number | null = null;
  if (pos(input.inflationPct) > 0 && x.principal > 0) {
    let lo = 0;
    let hi = 50;
    if (presentValueOf(input, "MONTHLY", hi, base).pv >= x.cash) {
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        if (presentValueOf(input, "MONTHLY", mid, base).pv >= x.cash) hi = mid;
        else lo = mid;
      }
      breakEvenMonthlyPct = hi;
    }
  }
  return {
    downAmount: x.down,
    principal: x.principal,
    fee: x.fee,
    installmentsTotal: x.total,
    totalPrice: x.down + x.total,
    markupPct: x.cash > 0 ? ((x.down + x.total - x.cash) / x.cash) * 100 : 0,
    rows: x.rows,
    presentValue: x.pv,
    realGain: x.pv - x.cash,
    breakEvenMonthlyPct,
  };
}
