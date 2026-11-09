/**
 * جدول اقساط وام — docs/plans/webhesab-parity.md بخش ۲۱. خالص؛ فرم و آزمون مشترک.
 *
 * کاهش مانده: سود هر قسط = مانده × نرخ دوره، قسط ثابت. ورودی یا نرخ سالانه است
 * یا مبلغ قسطی که بانک اعلام کرده؛ در حالت دوم نرخ دوره از روی قسط پیدا می‌شود.
 */

import { addJalaliMonths } from "./installments-calc";

export interface LoanScheduleRow {
  seq: number;
  dueDate: Date;
  principal: bigint;
  interest: bigint;
}

export interface LoanScheduleInput {
  principal: bigint;
  count: number;
  firstDue: Date;
  intervalMonths: number;
  /** نرخ سالانه × ۱۰۰ */
  rateBp?: number;
  /** مبلغ قسط اعلام‌شده؛ اگر باشد بر نرخ مقدم است */
  installment?: bigint;
}

const annuity = (p: number, r: number, n: number) => (r === 0 ? p / n : (p * r) / (1 - Math.pow(1 + r, -n)));

/** نرخ دوره‌ای که با آن قسط ثابت `a` وام را در `n` قسط صاف می‌کند */
function impliedRate(p: number, a: number, n: number): number {
  if (a * n <= p) return 0;
  let lo = 0;
  let hi = 1;
  while (annuity(p, hi, n) < a && hi < 1024) hi *= 2;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (annuity(p, mid, n) < a) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** جمع اصل همیشه دقیقاً برابر وام است؛ قسط آخر باقی‌مانده‌ی گرد کردن را می‌گیرد */
export function buildLoanSchedule(input: LoanScheduleInput): LoanScheduleRow[] {
  const { principal, count, firstDue, intervalMonths } = input;
  if (principal <= 0n || count < 1) return [];
  const p = Number(principal);
  const given = input.installment && input.installment > 0n ? Number(input.installment) : null;
  if (given !== null && given * count < p) return [];
  const r = given !== null ? impliedRate(p, given, count) : ((input.rateBp ?? 0) / 10000) * (intervalMonths / 12);
  const payment = given ?? annuity(p, r, count);

  const rows: LoanScheduleRow[] = [];
  let balance = p;
  for (let i = 0; i < count; i++) {
    const interest = Math.round(balance * r);
    let part = i === count - 1 ? balance : Math.round(payment) - interest;
    part = Math.min(Math.max(part, 0), balance);
    rows.push({
      seq: i + 1,
      dueDate: i === 0 ? firstDue : addJalaliMonths(firstDue, i * intervalMonths),
      principal: BigInt(part),
      interest: BigInt(interest),
    });
    balance -= part;
  }
  return rows;
}
