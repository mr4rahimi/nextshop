"use client";

/**
 * «عدد / کارتن» زیر تعداد ردیف — webhesab-parity.md بخش ۲۹ (فاکتور و سفارش خرید).
 * رفتن به بسته فی را × اندازه و تعداد را به بسته‌ی کامل (حداقل ۱) می‌برد؛ برگشت به واحد پایه برعکس.
 * ردیفی که `packSize` دارد: `qty` تعداد بسته است و فی برای هر بسته.
 */

import { divRound } from "@/lib/accounting/invoices/calc";
import { faNum, toLatinDigits } from "@/lib/accounting/money";

export interface PackRow {
  qty: string;
  unitPrice: string;
  packSize?: number;
}

const num = (v: string) => Number(toLatinDigits(v).replace(/[^\d]/g, "") || "0");

/** تعداد ردیف به واحد پایه */
export const packBaseQty = (l: Pick<PackRow, "qty" | "packSize">) => num(l.qty) * (l.packSize ?? 1);

export default function PackToggle({
  row,
  pack,
  unit,
  onChange,
}: {
  row: PackRow;
  pack: { unit: string; size: number };
  unit?: string | null;
  onChange: (p: Partial<PackRow>) => void;
}) {
  const { size } = pack;
  const n = num(row.qty);
  const toPack = () => onChange({ packSize: size, qty: String(Math.max(1, Math.floor(n / size))), unitPrice: row.unitPrice ? String(BigInt(row.unitPrice) * BigInt(size)) : "" });
  const toBase = () => onChange({ packSize: undefined, qty: String(n * size), unitPrice: row.unitPrice ? String(divRound(BigInt(row.unitPrice), BigInt(size))) : "" });
  const seg = (on: boolean) => `px-2 py-0.5 rounded-md ${on ? "bg-white dark:bg-gray-700 font-bold shadow-sm" : "text-gray-500"}`;
  return (
    <div className="mt-1 inline-flex rounded-lg bg-gray-200/70 dark:bg-white/10 p-0.5 text-[10px]">
      <button type="button" className={seg(!row.packSize)} onClick={() => row.packSize && toBase()}>
        {unit || "عدد"}
      </button>
      <button type="button" className={seg(!!row.packSize)} onClick={() => !row.packSize && toPack()}>
        {pack.unit} {faNum(size)}تایی
      </button>
    </div>
  );
}

/** «هر عدد ۱۲٬۵۰۰» زیر فی بسته */
export function PerUnitHint({ row, unit, formatAmount }: { row: PackRow; unit?: string | null; formatAmount: (v: bigint) => string }) {
  if (!row.packSize || !row.unitPrice) return null;
  return <span className="block text-[10px] text-gray-400">هر {unit || "عدد"} {formatAmount(divRound(BigInt(row.unitPrice), BigInt(row.packSize)))}</span>;
}
