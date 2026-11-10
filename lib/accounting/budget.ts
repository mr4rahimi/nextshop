/**
 * بودجه و مقایسه با عملکرد — docs/plans/webhesab-parity.md بخش ۲۲.
 *
 * بودجه فقط برنامه است و هیچ سندی نمی‌سازد. عملکرد از همان ردیف‌های سند و همان بخش‌بندی «سود و زیان»
 * جمع زده می‌شود، پس جمع‌های این گزارش با سود و زیان همان بازه یکی است.
 *
 * حساب کاهنده (برگشت از فروش، تخفیف) در هر دو ستون مثبت نمایش داده می‌شود و در جمع بخش کم می‌شود.
 */

import type { AccAccount, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError, toAmount } from "./errors";
import { todayKey } from "./dates";
import { natural, accountIndex, type Db as ReportDb } from "./reports/common";
import { plSections } from "./reports/statements";
import { fiscalMonths, seqOfDay, type FiscalMonth } from "./budget-calc";
import type { Actor } from "./ledger/post";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

const MAX_AMOUNT = 1_000_000_000_000_000n;

/** حساب کاهنده: درآمد با ماهیت بدهکار یا هزینه با ماهیت بستانکار */
const isContra = (a: AccAccount) => (a.class === "REVENUE" && a.nature === "DEBIT") || (a.class === "EXPENSE" && a.nature === "CREDIT");

/** افزایش عملکرد این حساب برای سود خوب است؟ */
const goodWhenUp = (a: AccAccount) => (a.class === "REVENUE") !== isContra(a);

async function resolveYear(db: Db, yearId: string | null | undefined) {
  const years = await db.accFiscalYear.findMany({
    orderBy: { startDate: "desc" },
    select: { id: true, title: true, startDate: true, endDate: true, status: true },
  });
  if (!years.length) throw new AccError("هنوز سال مالی تعریف نشده است", 404);
  const today = todayKey();
  const year = yearId ? years.find((y) => y.id === yearId) : (years.find((y) => y.startDate <= today && y.endDate >= today) ?? years[0]);
  if (!year) throw new AccError("سال مالی پیدا نشد", 404);
  return { years, year };
}

function sectionsOf(sec: ReturnType<typeof plSections>) {
  return [
    { key: "sales", title: "فروش خالص", accounts: sec.sales },
    { key: "cogs", title: "بهای تمام‌شده‌ی کالای فروش‌رفته", accounts: sec.cogs },
    { key: "otherIncome", title: "سایر درآمدها", accounts: sec.otherIncome },
    ...sec.expenses,
  ];
}

/** عملکرد هر حساب به تفکیک ماه؛ حساب کاهنده با علامت مثبت */
async function actualsByMonth(db: Db, months: FiscalMonth[], accounts: Map<string, AccAccount>) {
  const out = new Map<string, Map<number, bigint>>();
  if (!months.length) return out;
  const rows = await db.accVoucherLine.groupBy({
    by: ["accountId", "date"],
    where: { isVoid: false, date: { gte: months[0].from, lte: months[months.length - 1].to }, voucher: { source: { not: "CLOSING" } } },
    _sum: { debit: true, credit: true },
  });
  for (const r of rows) {
    const a = accounts.get(r.accountId);
    const seq = seqOfDay(months, r.date);
    if (!a || seq === null) continue;
    const value = natural(a.class, { debit: r._sum.debit ?? 0n, credit: r._sum.credit ?? 0n });
    const bySeq = out.get(a.id) ?? new Map<number, bigint>();
    bySeq.set(seq, (bySeq.get(seq) ?? 0n) + (isContra(a) ? -value : value));
    out.set(a.id, bySeq);
  }
  return out;
}

async function budgetsByMonth(db: Db, yearId: string) {
  const rows = await db.accBudget.findMany({ where: { yearId }, select: { accountId: true, seq: true, amount: true } });
  const out = new Map<string, Map<number, bigint>>();
  for (const r of rows) {
    const bySeq = out.get(r.accountId) ?? new Map<number, bigint>();
    bySeq.set(r.seq, r.amount);
    out.set(r.accountId, bySeq);
  }
  return out;
}

export interface BudgetSaveBody {
  yearId?: string;
  rows?: { accountId?: string; months?: unknown[] }[];
}

/** داده‌ی صفحه‌ی تنظیم بودجه، با عملکرد و بودجه‌ی همان ماه در سال قبل */
export async function budgetEditor(db: Db, yearId: string | null) {
  const { years, year } = await resolveYear(db, yearId);
  const months = fiscalMonths(year.startDate, year.endDate);
  const prevYear = years.find((y) => y.startDate < year.startDate) ?? null;
  const prevMonths = prevYear ? fiscalMonths(prevYear.startDate, prevYear.endDate) : [];

  const idx = await accountIndex(db);
  const sections = sectionsOf(plSections(idx));
  const accounts = new Map(sections.flatMap((s) => s.accounts).map((a) => [a.id, a]));
  const [budgets, prevBudgets, prevActuals] = await Promise.all([
    budgetsByMonth(db, year.id),
    prevYear ? budgetsByMonth(db, prevYear.id) : Promise.resolve(new Map<string, Map<number, bigint>>()),
    actualsByMonth(db, prevMonths, accounts),
  ]);

  // همان ماه شمسی در سال قبل؛ سال قبل ممکن است طول دیگری داشته باشد
  const prevSeqOf = (month: number) => prevMonths.filter((m) => m.month === month).at(-1)?.seq ?? null;
  const pick = (map: Map<number, bigint> | undefined, seq: number | null) => (seq === null ? 0n : (map?.get(seq) ?? 0n));

  return {
    year,
    years,
    prevYear,
    readOnly: year.status !== "OPEN",
    months,
    sections: sections
      .map((s) => ({
        key: s.key,
        title: s.title,
        accounts: s.accounts
          .filter((a) => a.isActive || budgets.has(a.id))
          .map((a) => ({
            accountId: a.id,
            code: a.code,
            name: a.name,
            contra: isContra(a),
            budget: months.map((m) => budgets.get(a.id)?.get(m.seq) ?? 0n),
            prevActual: months.map((m) => pick(prevActuals.get(a.id), prevSeqOf(m.month))),
            prevBudget: months.map((m) => pick(prevBudgets.get(a.id), prevSeqOf(m.month))),
          })),
      }))
      .filter((s) => s.accounts.length),
  };
}

/** ذخیره‌ی ردیف‌های تغییرکرده؛ بقیه‌ی حساب‌ها دست نمی‌خورند */
export async function saveBudget(tx: Tx, body: BudgetSaveBody, actor: Actor) {
  if (!body.yearId) throw new AccError("سال مالی را انتخاب کنید");
  if (!Array.isArray(body.rows) || !body.rows.length) throw new AccError("تغییری برای ذخیره نیست");
  const year = await tx.accFiscalYear.findUnique({ where: { id: body.yearId } });
  if (!year) throw new AccError("سال مالی پیدا نشد", 404);
  if (year.status !== "OPEN") throw new AccError("این سال مالی بسته است و بودجه‌اش تغییر نمی‌کند", 409);

  const months = fiscalMonths(year.startDate, year.endDate);
  const allowed = new Set(sectionsOf(plSections(await accountIndex(tx))).flatMap((s) => s.accounts.map((a) => a.id)));
  const seen = new Set<string>();
  const data: Prisma.AccBudgetCreateManyInput[] = [];
  for (const row of body.rows) {
    const accountId = row.accountId ?? "";
    if (!allowed.has(accountId)) throw new AccError("بودجه فقط برای حساب‌های معین فروش، درآمد و هزینه است");
    if (seen.has(accountId)) throw new AccError("یک حساب دو بار فرستاده شده است");
    seen.add(accountId);
    if (!Array.isArray(row.months) || row.months.length !== months.length) throw new AccError("تعداد ماه‌های بودجه درست نیست");
    row.months.forEach((value, i) => {
      const amount = toAmount(value, "مبلغ بودجه");
      if (amount < 0n || amount > MAX_AMOUNT) throw new AccError("مبلغ بودجه نامعتبر است");
      if (amount > 0n) data.push({ yearId: year.id, accountId, seq: months[i].seq, amount, updatedByName: actor.name });
    });
  }
  await tx.accBudget.deleteMany({ where: { yearId: year.id, accountId: { in: [...seen] } } });
  if (data.length) await tx.accBudget.createMany({ data });
  return { year, accounts: seen.size };
}

function sumMonths(map: Map<number, bigint> | undefined, months: FiscalMonth[]) {
  return months.reduce((s, m) => s + (map?.get(m.seq) ?? 0n), 0n);
}

/** گزارش بودجه در برابر عملکرد برای ماه‌های `fromSeq` تا `toSeq` */
export async function budgetReport(db: ReportDb, params: { yearId: string | null; fromSeq: number | null; toSeq: number | null }) {
  const { years, year } = await resolveYear(db, params.yearId);
  const months = fiscalMonths(year.startDate, year.endDate);
  const last = months.length;
  const fromSeq = Math.min(Math.max(params.fromSeq ?? 1, 1), last);
  const defaultTo = seqOfDay(months, todayKey()) ?? last;
  const toSeq = Math.max(Math.min(params.toSeq ?? defaultTo, last), fromSeq);
  const inRange = months.filter((m) => m.seq >= fromSeq && m.seq <= toSeq);

  const idx = await accountIndex(db);
  const sections = sectionsOf(plSections(idx));
  const accounts = new Map(sections.flatMap((s) => s.accounts).map((a) => [a.id, a]));
  const [budgets, actuals] = await Promise.all([budgetsByMonth(db, year.id), actualsByMonth(db, inRange, accounts)]);

  let over = 0;
  let unbudgeted = 0;
  const outSections = sections
    .map((s) => {
      let budgetTotal = 0n;
      let actualTotal = 0n;
      const rows = s.accounts.flatMap((a) => {
        const budget = sumMonths(budgets.get(a.id), inRange);
        const actual = sumMonths(actuals.get(a.id), inRange);
        if (budget === 0n && actual === 0n) return [];
        const sign = isContra(a) ? -1n : 1n;
        budgetTotal += sign * budget;
        actualTotal += sign * actual;
        const up = goodWhenUp(a);
        const isOff = budget > 0n && (up ? actual < budget : actual > budget);
        const noBudget = budget === 0n;
        if (noBudget) unbudgeted++;
        else if (isOff) over++;
        return [
          {
            accountId: a.id,
            code: a.code,
            name: a.name,
            contra: isContra(a),
            goodWhenUp: up,
            budget,
            actual,
            usedPct: budget > 0n ? Number((actual * 1000n) / budget) / 10 : null,
            status: noBudget ? ("unbudgeted" as const) : isOff ? ("off" as const) : ("ok" as const),
            months: inRange.map((m) => ({
              seq: m.seq,
              label: m.label,
              from: m.from,
              to: m.to,
              budget: budgets.get(a.id)?.get(m.seq) ?? 0n,
              actual: actuals.get(a.id)?.get(m.seq) ?? 0n,
            })),
          },
        ];
      });
      return { key: s.key, title: s.title, rows, budget: budgetTotal, actual: actualTotal };
    })
    .filter((s) => s.rows.length);

  const figure = (f: (s: (typeof outSections)[number]) => bigint) => {
    const of = (key: string) => outSections.filter((s) => s.key === key).reduce((sum, s) => sum + f(s), 0n);
    const expenses = outSections.filter((s) => s.key.startsWith("exp:")).reduce((sum, s) => sum + f(s), 0n);
    const netSales = of("sales");
    const gross = netSales - of("cogs");
    const otherIncome = of("otherIncome");
    return { netSales, gross, otherIncome, expenses, net: gross + otherIncome - expenses };
  };

  return {
    year,
    years,
    months,
    fromSeq,
    toSeq,
    from: inRange[0].from,
    to: inRange[inRange.length - 1].to,
    hasBudget: budgets.size > 0,
    sections: outSections,
    totals: { budget: figure((s) => s.budget), actual: figure((s) => s.actual) },
    counts: { off: over, unbudgeted },
  };
}
