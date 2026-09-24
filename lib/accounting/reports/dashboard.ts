/**
 * عددهای ماه جاری برای خانه‌ی حسابداری — docs/plans/accounting.md بخش ۱۱ (داشبورد).
 *
 * فروش خالص، سود ناخالص و هزینه‌ی ماه از همان `profitLoss` می‌آید تا با
 * گزارش سود و زیان یکی باشد؛ سری روزانه از همان حساب‌ها روز به روز.
 * «کارهای مانده»: رویداد مسدود/ناموفق، فاکتور فروش سررسیدگذشته، کالای منفی
 * و زیر نقطه‌ی سفارش.
 */

import { dayValue, daysBetween, jalaliMonthBounds, previousRange, todayKey } from "../dates";
import { invoiceOpenAmounts } from "../cash/allocation";
import { accountIndex, type Db } from "./common";
import { profitLoss } from "./statements";

export async function monthDashboard(db: Db) {
  const today = todayKey();
  const { start } = jalaliMonthBounds(today);
  const range = { from: start, to: today };
  const prev = previousRange(start, today);

  const [pl, idx] = await Promise.all([profitLoss(db, range, prev), accountIndex(db)]);

  // سری روزانه — فروش خالص، بهای تمام‌شده، هزینه
  const salesIds = new Set(pl.groups.sales.lines.map((l) => l.accountId));
  const cogsGroup = idx.chain(idx.byKey.get("COGS")?.id ?? "").find((a) => a.level === "GROUP");
  const daily = await db.accVoucherLine.groupBy({
    by: ["date", "accountId"],
    where: { isVoid: false, date: { gte: start, lte: today }, account: { class: { in: ["REVENUE", "EXPENSE"] } }, voucher: { source: { not: "CLOSING" } } },
    _sum: { debit: true, credit: true },
  });
  const days = daysBetween(start, today).map(dayValue);
  const pos = new Map(days.map((d, i) => [d, i]));
  const sales = days.map(() => 0n);
  const cogs = days.map(() => 0n);
  const expenses = days.map(() => 0n);
  for (const r of daily) {
    const i = pos.get(dayValue(r.date));
    if (i === undefined) continue;
    const d = r._sum.debit ?? 0n;
    const c = r._sum.credit ?? 0n;
    const acc = idx.byId.get(r.accountId);
    if (!acc) continue;
    if (salesIds.has(acc.id)) sales[i] += c - d;
    else if (acc.class === "EXPENSE" && idx.chain(acc.id).some((p) => p.id === cogsGroup?.id)) cogs[i] += d - c;
    else if (acc.class === "EXPENSE") expenses[i] += d - c;
  }

  // کارهای مانده
  const [events, dueInvoices, negative, lowStock] = await Promise.all([
    db.accEvent.count({ where: { status: { in: ["BLOCKED", "FAILED"] } } }),
    db.accInvoice.findMany({ where: { type: "SALES", status: "ISSUED", dueDate: { lt: today } }, select: { id: true } }),
    db.accProductCost.count({ where: { qtyOnHand: { lt: 0 } } }),
    db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM "Product" WHERE "trackStock" = true AND "isActive" = true AND "stock" <= "lowStockThreshold"`,
  ]);
  const open = await invoiceOpenAmounts(db, dueInvoices.map((i) => i.id));
  let overdue = 0n;
  let overdueCount = 0;
  for (const o of open.values()) {
    if (o.open > 0n) {
      overdue += o.open;
      overdueCount++;
    }
  }

  return {
    month: { from: start, to: today },
    totals: pl.totals,
    prevTotals: pl.prevTotals,
    series: { days, sales, cogs, expenses },
    alerts: { events, overdue, overdueCount, negative, lowStock: Number(lowStock[0]?.n ?? 0n) },
  };
}
