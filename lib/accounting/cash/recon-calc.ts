/**
 * محاسبه‌های خالص تطبیق بانک — docs/plans/webhesab-parity.md بخش ۲۰.
 */

import { toLatinDigits } from "../money";

/** متن عدد صورت‌حساب: ارقام فارسی، جداکننده، اعشار و منفی. خالی ← ۰، نامعتبر ← null */
export function parseBankAmount(raw: unknown): bigint | null {
  const s = toLatinDigits(String(raw ?? "")).replace(/[,٬\s]/g, "").replace(/−/g, "-");
  if (!s || s === "-") return 0n;
  const m = s.match(/^(\(?)(-?)(\d+)(?:\.\d+)?(\)?)$/);
  if (!m) return null;
  const v = BigInt(m[3]);
  return m[2] || m[1] ? -v : v;
}

/** ریال ← تومان، گرد به نزدیک‌ترین (پنج ریال به بالا) */
export function rialToToman(v: bigint): bigint {
  return v < 0n ? -((-v + 5n) / 10n) : (v + 5n) / 10n;
}

export interface MatchRow {
  id: string;
  amount: bigint;
  date: Date;
  refNo?: string | null;
}
export interface MatchLine {
  id: string;
  amount: bigint;
  date: Date;
  text: string;
}

const DAY = 86_400_000;

/**
 * جفت کردن ردیف بانک با ردیف دفتر: مبلغ دقیقاً برابر و فاصله‌ی تاریخ تا `windowDays`.
 * نزدیک‌ترین تاریخ اول؛ شماره‌ی پیگیری داخل شرح دفتر در تساوی برنده است. هر طرف فقط یک بار.
 */
export function autoMatch(rows: MatchRow[], lines: MatchLine[], windowDays: number): { rowId: string; lineId: string }[] {
  const pairs: { rowId: string; lineId: string; gap: number; ref: number }[] = [];
  const byAmount = new Map<string, MatchLine[]>();
  for (const l of lines) {
    const k = l.amount.toString();
    byAmount.set(k, [...(byAmount.get(k) ?? []), l]);
  }
  for (const r of rows) {
    for (const l of byAmount.get(r.amount.toString()) ?? []) {
      const gap = Math.round(Math.abs(r.date.getTime() - l.date.getTime()) / DAY);
      if (gap > windowDays) continue;
      pairs.push({ rowId: r.id, lineId: l.id, gap, ref: r.refNo && l.text.includes(r.refNo) ? 0 : 1 });
    }
  }
  pairs.sort((a, b) => a.ref - b.ref || a.gap - b.gap);
  const usedRow = new Set<string>();
  const usedLine = new Set<string>();
  const out: { rowId: string; lineId: string }[] = [];
  for (const p of pairs) {
    if (usedRow.has(p.rowId) || usedLine.has(p.lineId)) continue;
    usedRow.add(p.rowId);
    usedLine.add(p.lineId);
    out.push({ rowId: p.rowId, lineId: p.lineId });
  }
  return out;
}
