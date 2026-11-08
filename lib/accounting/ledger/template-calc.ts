/**
 * محاسبه‌ی مبلغ ردیف‌های ورودی سریع — docs/plans/webhesab-parity.md بخش ۱۹.
 *
 * بی‌وابستگی به دیتابیس تا فرم ثبت همان عددی را نشان دهد که سرور ثبت می‌کند.
 */

import { toLatinDigits } from "../money";

export type TemplateSide = "DEBIT" | "CREDIT";
export type TemplateAmountKind = "BASE" | "PERCENT" | "FIXED" | "ASK" | "REMAINDER";

export interface CalcLine {
  key: string;
  side: TemplateSide;
  kind: TemplateAmountKind;
  percentBps?: number | null;
  fixedAmount?: bigint | null;
}

export interface CalcResult {
  /** مبلغ هر ردیف با همان کلید؛ صفر یعنی ردیف در سند نمی‌آید */
  amounts: Record<string, bigint>;
  debit: bigint;
  credit: bigint;
  /** ردیف «مانده» منفی شد */
  negativeRemainder: boolean;
}

/** درصدی از مبلغ، گرد به نزدیک‌ترین واحد (نیم به بالا) */
export function percentOf(base: bigint, bps: number): bigint {
  return (base * BigInt(bps) + 5000n) / 10000n;
}

export function calcTemplate(lines: CalcLine[], base: bigint, asked: Record<string, bigint> = {}): CalcResult {
  const amounts: Record<string, bigint> = {};
  let debit = 0n;
  let credit = 0n;
  for (const l of lines) {
    if (l.kind === "REMAINDER") continue;
    const amount =
      l.kind === "BASE" ? base : l.kind === "PERCENT" ? percentOf(base, l.percentBps ?? 0) : l.kind === "FIXED" ? (l.fixedAmount ?? 0n) : (asked[l.key] ?? 0n);
    amounts[l.key] = amount;
    if (l.side === "DEBIT") debit += amount;
    else credit += amount;
  }

  let negativeRemainder = false;
  for (const l of lines) {
    if (l.kind !== "REMAINDER") continue;
    const amount = l.side === "DEBIT" ? credit - debit : debit - credit;
    if (amount < 0n) {
      negativeRemainder = true;
      amounts[l.key] = 0n;
      continue;
    }
    amounts[l.key] = amount;
    if (l.side === "DEBIT") debit += amount;
    else credit += amount;
  }
  return { amounts, debit, credit, negativeRemainder };
}

export const usesBase = (lines: Pick<CalcLine, "kind">[]) => lines.some((l) => l.kind === "BASE" || l.kind === "PERCENT");

/** «۹» یا «12.5» یا «۱۲٫۵» ← درصد × ۱۰۰؛ نامعتبر ← null */
export function parsePercent(v: unknown): number | null {
  const s = toLatinDigits(String(v ?? "")).trim().replace("٫", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const bps = Number(whole) * 100 + Number(frac.padEnd(2, "0") || 0);
  return Number.isSafeInteger(bps) ? bps : null;
}

/** ۱۲۵۰ ← «12.5» برای فیلد درصد */
export function formatPercent(bps: number | null | undefined): string {
  if (bps === null || bps === undefined) return "";
  const whole = Math.floor(bps / 100);
  const frac = bps % 100;
  return frac ? `${whole}.${String(frac).padStart(2, "0").replace(/0$/, "")}` : String(whole);
}

/** مبلغ نمونه‌ی بخش‌پذیر بر ۱۰۰۰۰ — بررسی تراز بدون خطای گرد کردن */
const SAMPLE = 100_000_000n;

/**
 * خطای ساختاری الگو (پیش از ذخیره) یا null. الگو بی ردیف «مانده» یا «هنگام ثبت»
 * باید با هر مبلغی تراز بماند؛ وگرنه هر بار ثبتش خطا می‌دهد.
 */
export function templateShapeError(lines: CalcLine[]): string | null {
  if (lines.length < 2) return "الگو دست‌کم دو ردیف لازم دارد";
  if (lines.length > 30) return "الگو حداکثر ۳۰ ردیف می‌تواند داشته باشد";
  if (lines.filter((l) => l.kind === "REMAINDER").length > 1) return "فقط یک ردیف می‌تواند «مانده» باشد";
  if (!lines.some((l) => l.side === "DEBIT") || !lines.some((l) => l.side === "CREDIT")) return "الگو باید هم ردیف بدهکار داشته باشد هم بستانکار";
  if (lines.some((l) => l.kind === "ASK")) return null;

  const r = calcTemplate(lines, SAMPLE);
  if (r.negativeRemainder && !lines.some((l) => l.kind === "FIXED")) return "ردیف «مانده» با این درصدها منفی می‌شود؛ طرف ردیف‌ها را بررسی کنید";
  if (!lines.some((l) => l.kind === "REMAINDER") && r.debit !== r.credit) return "الگو تراز نمی‌شود؛ یک ردیف را «مانده» کنید";
  return null;
}
