/**
 * سود و زیان و ترازنامه — docs/plans/accounting.md بخش ۱۱.
 *
 * سود و زیان:
 *   فروش خالص  = حساب‌های کلِ «فروش» (فروش − برگشت − تخفیف، با علامت خودشان)
 *   − بهای تمام‌شده (گروهِ حساب COGS)            = سود ناخالص
 *   + سایر درآمدها − هزینه‌ها                      = سود خالص
 * بخش‌بندی از جای حساب‌های سیستمی در درخت پیدا می‌شود، نه از کد ثابت؛ حسابی
 * که کسب‌وکار زیر همان کل/گروه ساخته خودش در بخش درست می‌نشیند.
 *
 * ⚠️ سند اختتامیه (`CLOSING`، فاز ۹) از سود و زیان کنار گذاشته می‌شود، وگرنه
 *    سال بسته‌شده سود صفر نشان می‌دهد.
 *
 * ترازنامه در یک تاریخ: دارایی = بدهی + حقوق صاحبان سرمایه + سود بسته‌نشده.
 * سود بسته‌نشده = همه‌ی درآمد و هزینه‌ی تا آن تاریخ که هنوز به سود انباشته
 * منتقل نشده — پس این تساوی همیشه برقرار است مگر دفتر ناتراز باشد.
 */

import type { AccAccount } from "@prisma/client";
import { accountIndex, dateWhere, natural, sumBig, sumsByAccount, type AccountIndex, type Db, type DateRange, type Sums } from "./common";

export interface StatementLine {
  accountId: string;
  code: string;
  name: string;
  amount: bigint;
  prev: bigint | null;
}
export interface StatementGroup {
  key: string;
  title: string;
  lines: StatementLine[];
  total: bigint;
  prevTotal: bigint | null;
}

function lines(accs: AccAccount[], cur: Map<string, Sums>, prev: Map<string, Sums> | null): StatementLine[] {
  return accs
    .map((a) => ({
      accountId: a.id,
      code: a.code,
      name: a.name,
      amount: natural(a.class, cur.get(a.id) ?? { debit: 0n, credit: 0n }),
      prev: prev ? natural(a.class, prev.get(a.id) ?? { debit: 0n, credit: 0n }) : null,
    }))
    .filter((l) => l.amount !== 0n || (l.prev ?? 0n) !== 0n);
}

function group(key: string, title: string, ls: StatementLine[], hasPrev: boolean): StatementGroup {
  return { key, title, lines: ls, total: sumBig(ls, (l) => l.amount), prevTotal: hasPrev ? sumBig(ls, (l) => l.prev ?? 0n) : null };
}

/** زیرحساب‌های معینِ زیر یک حساب (با خودش اگر معین است) */
const leavesUnder = (idx: AccountIndex, root: AccAccount | undefined) =>
  root ? [...idx.byId.values()].filter((a) => a.level === "SUBLEDGER" && idx.chain(a.id).some((p) => p.id === root.id)) : [];

export async function profitLoss(db: Db, range: DateRange, compare: DateRange | null) {
  const idx = await accountIndex(db);
  const notClosing = { voucher: { source: { not: "CLOSING" as const } } };
  const [cur, prev] = await Promise.all([
    sumsByAccount(db, { ...dateWhere(range), ...notClosing }),
    compare ? sumsByAccount(db, { ...dateWhere(compare), ...notClosing }) : Promise.resolve(null),
  ]);
  const hasPrev = !!prev;

  const salesLedger = idx.chain(idx.byKey.get("SALES")?.id ?? "").find((a) => a.level === "LEDGER");
  const cogsGroup = idx.chain(idx.byKey.get("COGS")?.id ?? "").find((a) => a.level === "GROUP");
  const sales = leavesUnder(idx, salesLedger);
  const cogs = leavesUnder(idx, cogsGroup);
  const used = new Set([...sales, ...cogs].map((a) => a.id));
  const leaves = [...idx.byId.values()].filter((a) => a.level === "SUBLEDGER" && !used.has(a.id));

  const salesG = group("sales", "فروش خالص", lines(sales, cur, prev), hasPrev);
  const cogsG = group("cogs", "بهای تمام‌شده‌ی کالای فروش‌رفته", lines(cogs, cur, prev), hasPrev);
  const otherIncomeG = group("otherIncome", "سایر درآمدها", lines(leaves.filter((a) => a.class === "REVENUE"), cur, prev), hasPrev);

  // هزینه‌ها به تفکیک حساب کل (هزینه‌های فروش، اداری، مالی، …)
  const expenseLeaves = leaves.filter((a) => a.class === "EXPENSE");
  const byLedger = new Map<string, AccAccount[]>();
  for (const a of expenseLeaves) {
    const l = idx.chain(a.id).find((x) => x.level === "LEDGER");
    const k = l?.id ?? "_";
    byLedger.set(k, [...(byLedger.get(k) ?? []), a]);
  }
  const expenseGroups = [...byLedger.entries()]
    .map(([k, accs]) => group(`exp:${k}`, idx.byId.get(k)?.name ?? "سایر هزینه‌ها", lines(accs, cur, prev), hasPrev))
    .filter((g) => g.lines.length)
    .sort((a, b) => (idx.byId.get(a.key.slice(4))?.code ?? "").localeCompare(idx.byId.get(b.key.slice(4))?.code ?? ""));

  const figure = (f: (g: StatementGroup) => bigint | null) => {
    const expenses = expenseGroups.reduce((s, g) => s + (f(g) ?? 0n), 0n);
    const net = f(salesG) ?? 0n;
    const gross = net - (f(cogsG) ?? 0n);
    return { netSales: net, gross, expenses, otherIncome: f(otherIncomeG) ?? 0n, net: gross + (f(otherIncomeG) ?? 0n) - expenses };
  };

  return {
    groups: { sales: salesG, cogs: cogsG, otherIncome: otherIncomeG, expenses: expenseGroups },
    totals: figure((g) => g.total),
    prevTotals: hasPrev ? figure((g) => g.prevTotal) : null,
  };
}

export async function balanceSheet(db: Db, asOf: Date) {
  const idx = await accountIndex(db);
  const sums = await sumsByAccount(db, { date: { lte: asOf } });

  const section = (cls: AccAccount["class"]) => {
    const byLedger = new Map<string, StatementLine[]>();
    for (const a of idx.byId.values()) {
      if (a.level !== "SUBLEDGER" || a.class !== cls) continue;
      const s = sums.get(a.id);
      if (!s) continue;
      const amount = natural(cls, s);
      if (amount === 0n) continue;
      const l = idx.chain(a.id).find((x) => x.level === "LEDGER");
      const k = l?.id ?? "_";
      byLedger.set(k, [...(byLedger.get(k) ?? []), { accountId: a.id, code: a.code, name: a.name, amount, prev: null }]);
    }
    return [...byLedger.entries()]
      .map(([k, ls]) => group(k, idx.byId.get(k)?.name ?? "سایر", ls.sort((x, y) => x.code.localeCompare(y.code)), false))
      .sort((a, b) => (idx.byId.get(a.key)?.code ?? "").localeCompare(idx.byId.get(b.key)?.code ?? ""));
  };

  const assets = section("ASSET");
  const liabilities = section("LIABILITY");
  const equity = section("EQUITY");
  let profit = 0n;
  for (const a of idx.byId.values()) {
    if (a.level !== "SUBLEDGER" || (a.class !== "REVENUE" && a.class !== "EXPENSE")) continue;
    const s = sums.get(a.id);
    if (s) profit += s.credit - s.debit;
  }
  const total = (gs: StatementGroup[]) => sumBig(gs, (g) => g.total);
  const totals = { assets: total(assets), liabilities: total(liabilities), equity: total(equity), profit };
  return {
    assets,
    liabilities,
    equity,
    totals,
    balanced: totals.assets === totals.liabilities + totals.equity + profit,
  };
}
