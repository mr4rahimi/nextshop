/**
 * محاسبه‌ی جدول اقساط — خالص، سمت مرورگر هم (فرم برنامه‌ی اقساط).
 * docs/plans/accounting.md بخش ۹.۳.
 *
 * کارمزد:
 *   NONE     بی‌کارمزد
 *   MONTHLY  مبلغ قسطی × درصد ماهانه × تعداد ماه دوره (ساده، نه مرکب) —
 *            همان حساب رایج بازار: «ماهی ۳ درصد»
 *   TOTAL    مبلغ قسطی × درصد کل دوره
 *   FIXED    مبلغ ثابت
 * «تعداد ماه دوره» = تعداد قسط × فاصله‌ی ماهانه.
 *
 * مبلغ هر قسط = (مبلغ قسطی + کارمزد) ÷ تعداد، رو به پایین گرد به `roundTo`؛
 * باقی‌مانده روی **قسط آخر** می‌آید تا جمع دقیقاً برابر باشد.
 */

import { fromJalali, toJalali } from "@/lib/club/jalali";

export type FeeMode = "NONE" | "MONTHLY" | "TOTAL" | "FIXED";

export const FEE_MODE_LABELS: Record<FeeMode, string> = {
  NONE: "بی‌کارمزد",
  MONTHLY: "درصد ماهانه",
  TOTAL: "درصد کل دوره",
  FIXED: "مبلغ ثابت",
};

export function calcFee(principal: bigint, mode: FeeMode, rateBp: number, count: number, intervalMonths: number, fixed: bigint = 0n): bigint {
  if (principal <= 0n) return 0n;
  switch (mode) {
    case "MONTHLY":
      return (principal * BigInt(rateBp) * BigInt(count * intervalMonths)) / 10000n;
    case "TOTAL":
      return (principal * BigInt(rateBp)) / 10000n;
    case "FIXED":
      return fixed > 0n ? fixed : 0n;
    default:
      return 0n;
  }
}

/** همان روز از ماه `n` ماه بعد — روز ۳۱ در ماه ۳۰ روزه روز آخر همان ماه می‌شود */
export function addJalaliMonths(day: Date, n: number): Date {
  const j = toJalali(day);
  const total = j.year * 12 + (j.month - 1) + n;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  for (let d = j.day; d > 28; d--) {
    const out = fromJalali(y, m, d);
    if (out && toJalali(out).month === m) return out;
  }
  return fromJalali(y, m, Math.min(j.day, 28))!;
}

export interface ScheduleRow {
  seq: number;
  dueDate: Date;
  amount: bigint;
}

export function buildSchedule(opts: { total: bigint; count: number; firstDue: Date; intervalMonths: number; roundTo: bigint }): ScheduleRow[] {
  const { total, count, firstDue, intervalMonths } = opts;
  if (count < 1 || total <= 0n) return [];
  const round = opts.roundTo > 0n ? opts.roundTo : 1n;
  let each = total / BigInt(count);
  each = (each / round) * round;
  const rows: ScheduleRow[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({ seq: i + 1, dueDate: i === 0 ? firstDue : addJalaliMonths(firstDue, i * intervalMonths), amount: each });
  }
  rows[rows.length - 1].amount = total - each * BigInt(count - 1);
  return rows;
}

export type InstallmentState = "PAID" | "PARTIAL" | "OVERDUE" | "DUE_SOON" | "UPCOMING";

export const INSTALLMENT_STATE_LABELS: Record<InstallmentState, string> = {
  PAID: "پرداخت شد",
  PARTIAL: "بخشی پرداخت شد",
  OVERDUE: "سررسید گذشته",
  DUE_SOON: "نزدیک سررسید",
  UPCOMING: "در پیش",
};

/**
 * پوشش قسط‌ها به ترتیب: اول «سر» (هرچه بیرون از اقساط است — پیش‌پرداخت و
 * پرداخت‌های پیش از برنامه)، بعد قسط ۱، ۲، … . برگشتی از آخرین قسط‌ها کم می‌شود.
 */
export function coverInstallments(
  items: { seq: number; dueDate: Date; amount: bigint }[],
  opts: { head: bigint; paid: bigint; returned: bigint; today: Date; soonDays?: number },
): { seq: number; amount: bigint; paid: bigint; left: bigint; state: InstallmentState }[] {
  const sorted = [...items].sort((a, b) => a.seq - b.seq);
  // برگشتی از آخر
  const eff = sorted.map((i) => i.amount);
  let ret = opts.returned;
  for (let k = eff.length - 1; k >= 0 && ret > 0n; k--) {
    const cut = eff[k] < ret ? eff[k] : ret;
    eff[k] -= cut;
    ret -= cut;
  }
  let cover = opts.paid - opts.head;
  if (cover < 0n) cover = 0n;
  const soon = opts.today.getTime() + (opts.soonDays ?? 7) * 86_400_000;
  return sorted.map((it, k) => {
    const amount = eff[k];
    const paid = cover >= amount ? amount : cover;
    cover -= paid;
    const left = amount - paid;
    let state: InstallmentState;
    if (left === 0n) state = "PAID";
    else if (it.dueDate.getTime() < opts.today.getTime()) state = "OVERDUE";
    else if (paid > 0n) state = "PARTIAL";
    else if (it.dueDate.getTime() <= soon) state = "DUE_SOON";
    else state = "UPCOMING";
    return { seq: it.seq, amount, paid, left, state };
  });
}

// ── شناسایی کارمزد به تناسب زمان — webhesab-parity.md بخش ۳۴.۳ ──

const DAY = 86_400_000;

/**
 * سهم کارمزد هر دوره به نسبت **مانده‌ی بدهی** در آن دوره (استاندارد ۳، پیوست بند ۷):
 * دوره‌ی k از سررسید قبلی (یا شروع) تا سررسید k است و مانده‌اش جمع قسط‌های k به بعد.
 * پس دوره‌های اول که مانده بیشتر است سهم بیشتری می‌گیرند. جمع سهم‌ها دقیقاً = کارمزد
 * (باقی‌مانده‌ی تقسیم روی دوره‌ی اول).
 */
export function feeShares(fee: bigint, items: { amount: bigint }[]): bigint[] {
  if (fee <= 0n || !items.length) return items.map(() => 0n);
  const w: bigint[] = [];
  let tail = 0n;
  for (let k = items.length - 1; k >= 0; k--) {
    tail += items[k].amount > 0n ? items[k].amount : 0n;
    w[k] = tail;
  }
  const W = w.reduce((s, x) => s + x, 0n);
  if (W <= 0n) return items.map((_, k) => (k === items.length - 1 ? fee : 0n));
  const shares = w.map((x) => (fee * x) / W);
  shares[0] += fee - shares.reduce((s, x) => s + x, 0n);
  return shares;
}

/**
 * کارمزدی که تا پایان روز `asOf` به دست آمده: سهم هر دوره روزبه‌روز در طول همان دوره،
 * و کامل وقتی سررسیدش رسید. بعد از آخرین سررسید = همه‌ی کارمزد.
 */
export function earnedFee(fee: bigint, start: Date, items: { dueDate: Date; amount: bigint }[], asOf: Date): bigint {
  if (fee <= 0n || !items.length) return 0n;
  const shares = feeShares(fee, items);
  const a = asOf.getTime();
  let prev = start.getTime();
  let earned = 0n;
  items.forEach((it, k) => {
    const s = prev;
    const e = Math.max(it.dueDate.getTime(), s);
    prev = e;
    if (a >= e) earned += shares[k];
    else if (a > s) earned += (shares[k] * BigInt(Math.round((a - s) / DAY))) / BigInt(Math.round((e - s) / DAY));
  });
  return earned;
}
