/**
 * تخصیص دریافت/پرداخت به فاکتور — docs/plans/accounting.md بخش ۹.۱.
 *
 * «مانده‌ی باز» فاکتور = جمع − برگشتی‌های معتبرش − تخصیص‌های دریافت/پرداخت معتبر.
 * دریافت به فاکتور فروش، پرداخت به فاکتور خرید. مازاد تخصیص‌نیافته روی خود
 * شخص می‌ماند (پیش‌دریافت / پیش‌پرداخت) — مانده‌ی شخص از سندهاست، نه از اینجا.
 *
 * ⚠️ `AccInvoice.paidTotal` تنها کش مجاز است و فقط `recalcPaid` می‌نویسدش (تله‌ی ۶).
 */

import type { AccInvoiceType, Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export interface OpenInvoice {
  id: string;
  type: AccInvoiceType;
  number: number | null;
  date: Date;
  dueDate: Date | null;
  total: bigint;
  returned: bigint;
  paid: bigint;
  open: bigint;
}

const RETURN_TYPE: Partial<Record<AccInvoiceType, AccInvoiceType>> = { SALES: "SALES_RETURN", PURCHASE: "PURCHASE_RETURN" };

/** مانده‌ی باز چند فاکتور صادرشده (فاکتور باطل یا پیش‌نویس ← صفر) */
export async function invoiceOpenAmounts(tx: Tx, invoiceIds: string[], excludeMoneyDocId?: string): Promise<Map<string, OpenInvoice>> {
  if (!invoiceIds.length) return new Map();
  const invs = await tx.accInvoice.findMany({
    where: { id: { in: invoiceIds } },
    select: { id: true, type: true, number: true, date: true, dueDate: true, total: true, status: true },
  });
  const [returns, allocs] = await Promise.all([
    tx.accInvoice.groupBy({
      by: ["refInvoiceId"],
      where: { refInvoiceId: { in: invoiceIds }, status: "ISSUED" },
      _sum: { total: true },
    }),
    tx.accAllocation.groupBy({
      by: ["invoiceId"],
      where: { invoiceId: { in: invoiceIds }, moneyDoc: { status: "POSTED", ...(excludeMoneyDocId ? { id: { not: excludeMoneyDocId } } : {}) } },
      _sum: { amount: true },
    }),
  ]);
  const ret = new Map(returns.map((r) => [r.refInvoiceId!, r._sum.total ?? 0n]));
  const paid = new Map(allocs.map((a) => [a.invoiceId, a._sum.amount ?? 0n]));
  const out = new Map<string, OpenInvoice>();
  for (const i of invs) {
    const returned = RETURN_TYPE[i.type] ? ret.get(i.id) ?? 0n : 0n;
    const p = paid.get(i.id) ?? 0n;
    const open = i.status === "ISSUED" ? i.total - returned - p : 0n;
    out.set(i.id, { id: i.id, type: i.type, number: i.number, date: i.date, dueDate: i.dueDate, total: i.total, returned, paid: p, open: open > 0n ? open : 0n });
  }
  return out;
}

/** فاکتورهای باز یک شخص، قدیمی‌ترین اول — فرم دریافت/پرداخت */
export async function openInvoicesOf(tx: Tx, partyId: string, side: "sales" | "purchase"): Promise<OpenInvoice[]> {
  const invs = await tx.accInvoice.findMany({
    where: { partyId, status: "ISSUED", type: side === "sales" ? "SALES" : "PURCHASE" },
    select: { id: true },
    orderBy: [{ date: "asc" }, { number: "asc" }],
  });
  const map = await invoiceOpenAmounts(tx, invs.map((i) => i.id));
  return invs.map((i) => map.get(i.id)!).filter((i) => i.open > 0n);
}

/** تخصیص خودکار از قدیمی‌ترین فاکتور — همان پیش‌فرض فرم */
export function autoAllocate(amount: bigint, open: { id: string; open: bigint }[]): { invoiceId: string; amount: bigint }[] {
  const out: { invoiceId: string; amount: bigint }[] = [];
  let left = amount;
  for (const inv of open) {
    if (left <= 0n) break;
    const a = inv.open < left ? inv.open : left;
    if (a > 0n) out.push({ invoiceId: inv.id, amount: a });
    left -= a;
  }
  return out;
}

/** بازنویسی کش `paidTotal` از روی تخصیص‌های معتبر */
export async function recalcPaid(tx: Tx, invoiceIds: string[]): Promise<void> {
  const ids = [...new Set(invoiceIds)];
  if (!ids.length) return;
  const sums = await tx.accAllocation.groupBy({
    by: ["invoiceId"],
    where: { invoiceId: { in: ids }, moneyDoc: { status: "POSTED" } },
    _sum: { amount: true },
  });
  const byId = new Map(sums.map((s) => [s.invoiceId, s._sum.amount ?? 0n]));
  for (const id of ids) {
    await tx.accInvoice.update({ where: { id }, data: { paidTotal: byId.get(id) ?? 0n } });
  }
}
