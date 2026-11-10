/**
 * محاسبه‌های بودجه بدون دیتابیس، مشترک سرور و فرم — docs/plans/webhesab-parity.md بخش ۲۲.
 */

import { fromJalali, jalaliMonthName, toJalali } from "@/lib/club/jalali";

const DAY_MS = 86_400_000;
const ROUND = 1000n;

export interface FiscalMonth {
  /** شماره‌ی ماه از اول سال مالی */
  seq: number;
  /** ماه شمسی (۱ تا ۱۲) */
  month: number;
  label: string;
  from: Date;
  to: Date;
}

/** ماه‌های شمسی سال مالی؛ ماه اول و آخر به مرز سال بریده می‌شوند */
export function fiscalMonths(start: Date, end: Date): FiscalMonth[] {
  const startJ = toJalali(start);
  const multiYear = toJalali(end).year !== startJ.year;
  const out: FiscalMonth[] = [];
  let { year, month } = startJ;
  while (out.length < 240) {
    const first = fromJalali(year, month, 1)!;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const next = fromJalali(nextYear, nextMonth, 1)!;
    const last = new Date(next.getTime() - DAY_MS);
    out.push({
      seq: out.length + 1,
      month,
      label: multiYear ? `${jalaliMonthName(month)} ${year}` : jalaliMonthName(month),
      from: first < start ? start : first,
      to: last > end ? end : last,
    });
    if (next > end) break;
    year = nextYear;
    month = nextMonth;
  }
  return out;
}

/** شماره‌ی ماهی که این روز در آن است؛ بیرون از سال تهی */
export function seqOfDay(months: FiscalMonth[], day: Date): number | null {
  return months.find((m) => day >= m.from && day <= m.to)?.seq ?? null;
}

/** تقسیم مبلغ سالانه بین ماه‌ها؛ سهم هر ماه به هزار گرد و باقی‌مانده با ماه آخر */
export function spreadEvenly(total: bigint, n: number): bigint[] {
  if (n <= 0 || total <= 0n) return Array.from({ length: Math.max(n, 0) }, () => 0n);
  const count = BigInt(n);
  const share = total / count;
  const each = share >= ROUND ? (share / ROUND) * ROUND : share;
  const out = Array.from({ length: n }, () => each);
  out[n - 1] = total - each * (count - 1n);
  return out;
}

/** مبلغ با درصد افزایش یا کاهش، گرد به هزار؛ هیچ‌وقت منفی نمی‌شود */
export function growAmount(amount: bigint, pct: number): bigint {
  if (amount <= 0n) return 0n;
  const scaled = amount * BigInt(10_000 + Math.round(pct * 100));
  const value = (scaled + 5_000n) / 10_000n;
  if (value <= 0n) return 0n;
  return value >= ROUND ? ((value + ROUND / 2n) / ROUND) * ROUND : value;
}
