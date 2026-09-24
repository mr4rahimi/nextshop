/**
 * گزارش‌های عملیاتی — ارزش افزوده، هزینه‌ها، گردش خزانه، ارزش موجودی
 * (docs/plans/accounting.md بخش ۱۱).
 *
 * عددهای مالی از دفتر؛ فهرست فاکتورهای مشمول مالیات و مقدار کالا از جدول خودشان.
 */

import { accountIndex, dateWhere, natural, sumBig, sumsByAccount, type Db, type DateRange } from "./common";
import { balanceOf } from "../ledger/balances";

// ── ارزش افزوده ──

export async function vatReport(db: Db, range: DateRange) {
  const [sales, purchase] = await Promise.all([
    balanceOf(db, { account: { systemKey: "VAT_SALES" }, ...dateWhere(range) }),
    balanceOf(db, { account: { systemKey: "VAT_PURCHASE" }, ...dateWhere(range) }),
  ]);
  const dateF = range.from || range.to ? { date: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } } : {};
  const [invoices, expenses] = await Promise.all([
    db.accInvoice.findMany({
      where: { status: "ISSUED", vatTotal: { not: 0n }, type: { in: ["SALES", "SALES_RETURN", "PURCHASE", "PURCHASE_RETURN"] }, ...dateF },
      orderBy: [{ date: "asc" }, { number: "asc" }],
      select: { id: true, type: true, number: true, date: true, partyName: true, partyNationalId: true, partyEconomicCode: true, total: true, vatTotal: true },
    }),
    db.accMoneyDoc.findMany({
      where: { kind: "EXPENSE", status: "POSTED", vatAmount: { gt: 0n }, ...dateF },
      orderBy: [{ date: "asc" }, { number: "asc" }],
      select: { id: true, number: true, date: true, total: true, vatAmount: true, party: { select: { name: true } } },
    }),
  ]);
  const vatSales = -sales.balance; // بستانکار
  const vatPurchase = purchase.balance; // بدهکار
  return { vatSales, vatPurchase, payable: vatSales - vatPurchase, invoices, expenses };
}

// ── هزینه‌ها ──

/** هزینه‌ها به تفکیک سرفصل از دفتر (سند دستی هم دیده می‌شود)، بی‌بهای تمام‌شده */
export async function expenseReport(db: Db, range: DateRange, compare: DateRange | null) {
  const idx = await accountIndex(db);
  const cogsGroup = idx.chain(idx.byKey.get("COGS")?.id ?? "").find((a) => a.level === "GROUP");
  const accs = [...idx.byId.values()].filter((a) => a.level === "SUBLEDGER" && a.class === "EXPENSE" && !idx.chain(a.id).some((p) => p.id === cogsGroup?.id));
  const notClosing = { voucher: { source: { not: "CLOSING" as const } } };
  const [cur, prev] = await Promise.all([
    sumsByAccount(db, { accountId: { in: accs.map((a) => a.id) }, ...dateWhere(range), ...notClosing }),
    compare ? sumsByAccount(db, { accountId: { in: accs.map((a) => a.id) }, ...dateWhere(compare), ...notClosing }) : Promise.resolve(null),
  ]);
  const rows = accs
    .map((a) => ({
      accountId: a.id,
      code: a.code,
      name: a.name,
      group: idx.chain(a.id).find((x) => x.level === "LEDGER")?.name ?? "",
      amount: natural("EXPENSE", cur.get(a.id) ?? { debit: 0n, credit: 0n }),
      prev: prev ? natural("EXPENSE", prev.get(a.id) ?? { debit: 0n, credit: 0n }) : null,
    }))
    .filter((r) => r.amount !== 0n || (r.prev ?? 0n) !== 0n)
    .sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0));
  return { rows, total: sumBig(rows, (r) => r.amount), prevTotal: prev ? sumBig(rows, (r) => r.prev ?? 0n) : null };
}

// ── گردش خزانه ──

export async function treasuryFlow(db: Db, range: DateRange) {
  const treasuries = await db.accTreasury.findMany({ orderBy: [{ kind: "asc" }, { code: "asc" }], select: { id: true, name: true, kind: true, isActive: true } });
  const [before, during] = await Promise.all([
    range.from
      ? db.accVoucherLine.groupBy({ by: ["treasuryId"], where: { isVoid: false, treasuryId: { not: null }, date: { lt: range.from } }, _sum: { debit: true, credit: true } })
      : Promise.resolve([]),
    db.accVoucherLine.groupBy({ by: ["treasuryId"], where: { isVoid: false, treasuryId: { not: null }, ...dateWhere(range) }, _sum: { debit: true, credit: true } }),
  ]);
  const open = new Map(before.map((b) => [b.treasuryId!, (b._sum.debit ?? 0n) - (b._sum.credit ?? 0n)]));
  const flow = new Map(during.map((b) => [b.treasuryId!, { in: b._sum.debit ?? 0n, out: b._sum.credit ?? 0n }]));
  const rows = treasuries
    .map((t) => {
      const o = open.get(t.id) ?? 0n;
      const f = flow.get(t.id) ?? { in: 0n, out: 0n };
      return { ...t, opening: o, in: f.in, out: f.out, closing: o + f.in - f.out };
    })
    .filter((r) => r.isActive || r.opening !== 0n || r.in !== 0n || r.out !== 0n);
  return {
    rows,
    totals: { opening: sumBig(rows, (r) => r.opening), in: sumBig(rows, (r) => r.in), out: sumBig(rows, (r) => r.out), closing: sumBig(rows, (r) => r.closing) },
  };
}

// ── ارزش موجودی ──

/**
 * تعداد هر انبار × میانگین موزون سراسری (تصمیم ۷). ارزش هر کالا در همه‌ی
 * انبارها = `AccProductCost.totalValue`؛ تقسیم بین انبارها به نسبت تعداد است.
 * کنارش مانده‌ی حساب «موجودی کالا» در دفتر برای تطبیق.
 */
export async function inventoryValue(db: Db, opts: { warehouseId: string | null; by: "category" | "product" | "warehouse" }) {
  const [stocks, costs, warehouses, ledger] = await Promise.all([
    db.accStock.findMany({ where: { qty: { not: 0 }, ...(opts.warehouseId ? { warehouseId: opts.warehouseId } : {}) } }),
    db.accProductCost.findMany(),
    db.accWarehouse.findMany({ select: { id: true, name: true } }),
    balanceOf(db, { account: { systemKey: "INVENTORY" } }),
  ]);
  const cost = new Map(costs.map((c) => [c.productId, c]));
  // سهم ارزش به نسبت تعداد، نه «تعداد × میانگین گرد‌شده» — جمع انبارها همان ارزش کاردکس
  const valueOf = (productId: string, qty: number) => {
    const c = cost.get(productId);
    if (!c) return 0n;
    return c.qtyOnHand > 0 ? (c.totalValue * BigInt(qty)) / BigInt(c.qtyOnHand) : BigInt(qty) * c.lastCost;
  };
  const products = await db.product.findMany({ where: { id: { in: [...new Set(stocks.map((s) => s.productId))] } }, select: { id: true, title: true, categoryId: true } });
  const pInfo = new Map(products.map((p) => [p.id, p]));
  const cats = opts.by === "category" ? await db.category.findMany({ where: { id: { in: [...new Set(products.map((p) => p.categoryId))] } }, select: { id: true, title: true } }) : [];
  const catName = new Map(cats.map((c) => [c.id, c.title]));
  const whName = new Map(warehouses.map((w) => [w.id, w.name]));

  const rows = new Map<string, { key: string; label: string; qty: number; value: bigint; products: number }>();
  const seen = new Map<string, Set<string>>();
  for (const s of stocks) {
    const p = pInfo.get(s.productId);
    const [key, label] =
      opts.by === "product"
        ? [s.productId, p?.title ?? "—"]
        : opts.by === "warehouse"
          ? [s.warehouseId, whName.get(s.warehouseId) ?? "—"]
          : [p?.categoryId ?? "_none", (p && catName.get(p.categoryId)) || "بی‌دسته"];
    const r = rows.get(key) ?? { key, label, qty: 0, value: 0n, products: 0 };
    r.qty += s.qty;
    r.value += valueOf(s.productId, s.qty);
    const set = seen.get(key) ?? new Set();
    set.add(s.productId);
    seen.set(key, set);
    r.products = set.size;
    rows.set(key, r);
  }
  const list = [...rows.values()].sort((a, b) => (b.value > a.value ? 1 : b.value < a.value ? -1 : 0));
  return {
    rows: list,
    totals: { qty: list.reduce((s, r) => s + r.qty, 0), value: sumBig(list, (r) => r.value) },
    /** ارزش سراسری کاردکس و مانده‌ی حساب موجودی کالا — باید برابر باشند */
    kardexValue: sumBig(costs, (c) => c.totalValue),
    ledgerValue: ledger.balance,
  };
}
