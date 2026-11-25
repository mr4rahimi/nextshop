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
 * بعد از بستن سال، سود آن سال در «سود انباشته» است و درآمد و هزینه‌اش صفر.
 */

import type { AccAccount } from "@prisma/client";
import { NOT_CARRY } from "../ledger/balances";
import { addJalaliMonths } from "../installments-calc";
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

/** حساب‌های معین سود و زیان به همان بخش‌بندی صورت سود و زیان؛ بودجه هم از همین می‌خواند */
export function plSections(idx: AccountIndex) {
  const salesLedger = idx.chain(idx.byKey.get("SALES")?.id ?? "").find((a) => a.level === "LEDGER");
  const cogsGroup = idx.chain(idx.byKey.get("COGS")?.id ?? "").find((a) => a.level === "GROUP");
  const sales = leavesUnder(idx, salesLedger);
  const cogs = leavesUnder(idx, cogsGroup);
  const used = new Set([...sales, ...cogs].map((a) => a.id));
  const leaves = [...idx.byId.values()].filter((a) => a.level === "SUBLEDGER" && !used.has(a.id));

  // هزینه‌ها به تفکیک حساب کل (هزینه‌های فروش، اداری، مالی، …)
  const byLedger = new Map<string, AccAccount[]>();
  for (const a of leaves.filter((x) => x.class === "EXPENSE")) {
    const l = idx.chain(a.id).find((x) => x.level === "LEDGER");
    const k = l?.id ?? "_";
    byLedger.set(k, [...(byLedger.get(k) ?? []), a]);
  }
  const expenses = [...byLedger.entries()]
    .sort(([a], [b]) => (idx.byId.get(a)?.code ?? "").localeCompare(idx.byId.get(b)?.code ?? ""))
    .map(([k, accounts]) => ({ key: `exp:${k}`, title: idx.byId.get(k)?.name ?? "سایر هزینه‌ها", accounts }));

  return { sales, cogs, otherIncome: leaves.filter((a) => a.class === "REVENUE"), expenses };
}

export async function profitLoss(db: Db, range: DateRange, compare: DateRange | null) {
  const idx = await accountIndex(db);
  const notClosing = { voucher: { source: { not: "CLOSING" as const } } };
  const [cur, prev] = await Promise.all([
    sumsByAccount(db, { ...dateWhere(range), ...notClosing }),
    compare ? sumsByAccount(db, { ...dateWhere(compare), ...notClosing }) : Promise.resolve(null),
  ]);
  const hasPrev = !!prev;

  const sec = plSections(idx);
  const salesG = group("sales", "فروش خالص", lines(sec.sales, cur, prev), hasPrev);
  const cogsG = group("cogs", "بهای تمام‌شده‌ی کالای فروش‌رفته", lines(sec.cogs, cur, prev), hasPrev);
  const otherIncomeG = group("otherIncome", "سایر درآمدها", lines(sec.otherIncome, cur, prev), hasPrev);
  const expenseGroups = sec.expenses
    .map((e) => group(e.key, e.title, lines(e.accounts, cur, prev), hasPrev))
    .filter((g) => g.lines.length);

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

/**
 * بخش بلندمدت وام‌ها در یک تاریخ (استاندارد ۱): اصل قسط‌هایی که سررسیدشان بیش از ۱۲ ماه بعد است
 * و تا آن روز پرداخت نشده بودند. فقط نمایش است؛ سندی نمی‌خورد.
 */
async function loanLongTerm(db: Db, asOf: Date): Promise<bigint> {
  const horizon = addJalaliMonths(asOf, 12);
  const s = await db.accLoanInstallment.aggregate({
    where: {
      dueDate: { gt: horizon },
      OR: [{ paidAt: null }, { paidAt: { gt: asOf } }],
      loan: { status: { not: "VOID" }, date: { lte: asOf } },
    },
    _sum: { principal: true },
  });
  return s._sum.principal ?? 0n;
}

export type Term = "current" | "noncurrent";
export type SheetGroup = StatementGroup & { term?: Term };

export async function balanceSheet(db: Db, asOf: Date) {
  const idx = await accountIndex(db);
  // اختتامیه/افتتاحیه‌ی خودکار کنار — مانده‌ی دائم از خود دفتر؛ سود سال‌های بسته در سود انباشته
  const sums = await sumsByAccount(db, { date: { lte: asOf }, ...NOT_CARRY });
  const groupOf = (id: string) => idx.chain(id).find((x) => x.level === "GROUP")?.id ?? null;
  // جاری = گروهی که «موجودی کالا» (دارایی) یا «حساب‌های پرداختنی» (بدهی) در آن است؛ بقیه غیرجاری
  const currentGroup = { ASSET: groupOf(idx.byKey.get("INVENTORY")?.id ?? ""), LIABILITY: groupOf(idx.byKey.get("AP")?.id ?? "") } as Record<string, string | null>;

  const section = (cls: AccAccount["class"]): SheetGroup[] => {
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
    const cur = currentGroup[cls];
    return [...byLedger.entries()]
      .map(([k, ls]) => ({
        ...group(k, idx.byId.get(k)?.name ?? "سایر", ls.sort((x, y) => x.code.localeCompare(y.code)), false),
        ...(cur !== undefined && cur ? { term: (groupOf(k) === cur ? "current" : "noncurrent") as Term } : {}),
      }))
      .sort((a, b) => (a.term === b.term ? 0 : a.term === "current" ? -1 : 1) || (idx.byId.get(a.key)?.code ?? "").localeCompare(idx.byId.get(b.key)?.code ?? ""));
  };

  const assets = section("ASSET");
  const liabilities = section("LIABILITY");
  const equity = section("EQUITY");

  // بخش بلندمدت وام از «تسهیلات دریافتی» جدا و در بدهی‌های غیرجاری نشان داده می‌شود
  const loanAcc = idx.byKey.get("LOAN_PAYABLE");
  const loanGroup = loanAcc ? liabilities.find((g) => g.lines.some((l) => l.accountId === loanAcc.id)) : undefined;
  const loanLine = loanGroup?.lines.find((l) => l.accountId === loanAcc!.id);
  let loansLong = 0n;
  if (loanGroup && loanLine && loanLine.amount > 0n && loanGroup.term === "current") {
    const lt = await loanLongTerm(db, asOf);
    loansLong = lt > loanLine.amount ? loanLine.amount : lt;
    if (loansLong > 0n) {
      loanLine.amount -= loansLong;
      loanLine.name = `${loanLine.name} — بخش جاری`;
      loanGroup.total -= loansLong;
      const long: SheetGroup = {
        key: "loans-long",
        title: "تسهیلات بلندمدت",
        lines: [{ accountId: loanAcc!.id, code: loanAcc!.code, name: "تسهیلات دریافتی — سررسید بیش از یک سال", amount: loansLong, prev: null }],
        total: loansLong,
        prevTotal: null,
        term: "noncurrent",
      };
      const at = liabilities.findIndex((g) => g.term === "noncurrent");
      liabilities.splice(at < 0 ? liabilities.length : at, 0, long);
    }
  }

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
    loansLong,
    balanced: totals.assets === totals.liabilities + totals.equity + profit,
  };
}
