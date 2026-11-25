/**
 * درآمد اقساطی به تناسب زمان — docs/plans/webhesab-parity.md بخش ۳۴.۳ (استاندارد ۳، پیوست بند ۷).
 *
 * کارمزد برنامه‌ی اقساط روز قسط‌بندی درآمد نیست؛ پول زمان است و با گذشت ماه‌ها به دست می‌آید:
 *
 *   قسط‌بندی فروش   بد طلب از شخص               / بس «درآمد تحقق‌نیافته‌ی اقساط»  (installments.ts)
 *   آخر هر ماه       بد «درآمد تحقق‌نیافته‌ی اقساط» / بس «درآمد فروش اقساطی»     (همین فایل)
 *   قسط‌بندی خرید    بد «پیش‌پرداخت کارمزد خرید اقساطی» / بس بدهی به شخص
 *   آخر هر ماه       بد «کارمزد خرید اقساطی»       / بس «پیش‌پرداخت کارمزد…»
 *
 * سهم هر ماه = `earnedFee` (به نسبت مانده‌ی هر دوره) تا آخر ماه − آنچه قبلاً شناسایی شده
 * (`AccInstallmentPlan.recognized`). چون همیشه «تا امروز منهای قبلی» است، تغییر زمان‌بندی،
 * تسویه‌ی زودتر (همه‌ی باقی در ماه تسویه) و برنامه‌ی دیر ثبت‌شده خودشان در سند ماه بعد جبران می‌شوند.
 * ماه قفل‌شده یا بی‌سال‌مالی رد می‌شود و سهمش به اولین ماه باز می‌رود.
 *
 * برنامه‌های پیش از ۲.۱۶۲.۰ (`deferred = false`) کارمزدشان یک‌جا درآمد شده بود؛ «تبدیل» سهم
 * ماه‌های نیامده را با یک سند اصلاحی به درآمد تحقق‌نیافته برمی‌گرداند.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jalaliMonthName, toJalali } from "@/lib/club/jalali";
import { AccError } from "./errors";
import { ensureSystemAccount } from "./ledger/accounts";
import { balanceOf } from "./ledger/balances";
import { yearForDate } from "./ledger/fiscal-year";
import { postVoucher, type Actor, type LineInput } from "./ledger/post";
import { jalaliMonthBounds, todayKey } from "./dates";
import { faNum, formatAmount } from "./money";
import { invoiceOpenAmounts } from "./cash/allocation";
import { earnedFee } from "./installments-calc";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

const DAY = 86_400_000;
export const DEFERRED_KEY = "INSTALLMENT_DEFERRED";
export const PREPAID_KEY = "INSTALLMENT_PREPAID";

/** حساب‌های تازه برای نصب‌های پیش از ۲.۱۶۲.۰ — زیر «پیش‌دریافت‌ها» (۳۳) و «پیش‌پرداخت‌ها» (۱۴) */
export async function ensureInstallmentAccounts(tx: Tx) {
  await ensureSystemAccount(tx, { key: DEFERRED_KEY, name: "درآمد تحقق‌نیافته‌ی اقساط", parentCode: "33", cls: "LIABILITY", nature: "CREDIT" });
  await ensureSystemAccount(tx, { key: PREPAID_KEY, name: "پیش‌پرداخت کارمزد خرید اقساطی", parentCode: "14", cls: "ASSET", nature: "DEBIT" });
}

type Side = "sales" | "purchase";
const sideOf = (type: string): Side => (type === "PURCHASE" ? "purchase" : "sales");

/**
 * جابه‌جایی `amount` از حساب انتظار به درآمد/هزینه (+ = شناسایی، − = برگشت شناسایی).
 * `other` = طرف دیگر به جای درآمد/هزینه (تبدیل برنامه‌ی سال قبل ← سود انباشته).
 */
export function recognizeLines(side: Side, amount: bigint, description: string, other?: string): LineInput[] {
  if (amount === 0n) return [];
  const a = amount > 0n ? amount : -amount;
  const fwd = amount > 0n;
  if (side === "sales") {
    const pl = other ?? "INSTALLMENT_INCOME";
    return fwd
      ? [{ accountKey: DEFERRED_KEY, debit: a, description }, { accountKey: pl, credit: a, description }]
      : [{ accountKey: pl, debit: a, description }, { accountKey: DEFERRED_KEY, credit: a, description }];
  }
  const pl = other ?? "INSTALLMENT_EXPENSE";
  return fwd
    ? [{ accountKey: pl, debit: a, description }, { accountKey: PREPAID_KEY, credit: a, description }]
    : [{ accountKey: PREPAID_KEY, debit: a, description }, { accountKey: pl, credit: a, description }];
}

/** آخرین روز ماه شمسی گذشته — سند هر ماه بعد از تمام شدنش */
export function lastClosedMonthEnd(today: Date = todayKey()): Date {
  return new Date(jalaliMonthBounds(today).start.getTime() - DAY);
}

export const monthTitle = (d: Date) => {
  const j = toJalali(d);
  return `${jalaliMonthName(j.month)} ${faNum(j.year)}`;
};

export async function postableOn(db: Db, day: Date): Promise<boolean> {
  const y = await yearForDate(db, day);
  if (!y || y.status === "CLOSED") return false;
  const s = await db.accSettings.findUnique({ where: { id: "singleton" }, select: { lockDate: true } });
  return !(s?.lockDate && day.getTime() <= s.lockDate.getTime());
}

const planInclude = {
  items: { orderBy: { seq: "asc" as const }, select: { dueDate: true, amount: true } },
  invoice: { select: { id: true, type: true, number: true, partyName: true, date: true } },
} satisfies Prisma.AccInstallmentPlanInclude;
type PlanFull = Prisma.AccInstallmentPlanGetPayload<{ include: typeof planInclude }>;

const startOf = (p: PlanFull) => p.feeDate ?? p.invoice.date;

/** هدف شناسایی تا `asOf`؛ `settled` = فاکتور کامل پرداخت شده ← همه‌ی کارمزد */
function targetOf(p: PlanFull, asOf: Date, settled: boolean): bigint {
  if (asOf.getTime() < startOf(p).getTime()) return 0n;
  if (settled) return p.feeAmount;
  return earnedFee(p.feeAmount, startOf(p), p.items, asOf);
}

async function settledSet(db: Db, plans: PlanFull[]): Promise<Set<string>> {
  if (!plans.length) return new Set();
  const open = await invoiceOpenAmounts(db as Tx, plans.map((p) => p.invoiceId));
  return new Set(plans.filter((p) => (open.get(p.invoiceId)?.open ?? 1n) <= 0n).map((p) => p.id));
}

const planLabel = (p: PlanFull) => `${p.invoice.type === "PURCHASE" ? "خرید" : "فروش"} ${faNum(p.invoice.number ?? 0)} ${p.invoice.partyName}`;

/**
 * سند ماه‌های تمام‌شده‌ای که هنوز سند نخورده‌اند (worker روزانه؛ دکمه‌ی «همین حالا ثبت کن»).
 * هر ماه یک سند؛ ماهی که چیزی برای ثبت نداشت فقط علامت می‌خورد.
 */
export async function accrueInstallments(tx: Tx, actor: Actor, opts: { today?: Date } = {}) {
  const s = await tx.accSettings.findUnique({ where: { id: "singleton" }, select: { mode: true, installmentAccruedThrough: true } });
  if (s?.mode !== "INTERNAL") return { months: 0, vouchers: [] as string[], amount: 0n };
  const L = lastClosedMonthEnd(opts.today);
  const plans = await tx.accInstallmentPlan.findMany({ where: { deferred: true, feeAmount: { gt: 0n } }, include: planInclude });
  if (!plans.length) return { months: 0, vouchers: [] as string[], amount: 0n, plans: 0 };
  const first = s.installmentAccruedThrough
    ? new Date(s.installmentAccruedThrough.getTime() + DAY)
    : plans.reduce((m, p) => (startOf(p).getTime() < m.getTime() ? startOf(p) : m), startOf(plans[0]));
  if (first.getTime() > L.getTime()) return { months: 0, vouchers: [] as string[], amount: 0n };
  const settled = await settledSet(tx, plans);
  const rec = new Map(plans.map((p) => [p.id, p.recognized]));
  const vouchers: string[] = [];
  let months = 0;
  let total = 0n;
  let through: Date | null = null;
  for (let m = jalaliMonthBounds(first); m.start.getTime() <= L.getTime(); m = jalaliMonthBounds(new Date(m.end.getTime() + DAY))) {
    const E = m.end;
    if (!(await postableOn(tx, E))) continue;
    const lines: LineInput[] = [];
    const moved: [string, bigint][] = [];
    for (const p of plans) {
      const delta = targetOf(p, E, E.getTime() === L.getTime() && settled.has(p.id)) - rec.get(p.id)!;
      if (delta === 0n) continue;
      lines.push(...recognizeLines(sideOf(p.invoice.type), delta, `کارمزد اقساط ${planLabel(p)}`));
      moved.push([p.id, delta]);
    }
    if (lines.length) {
      await ensureInstallmentAccounts(tx);
      const sum = moved.reduce((a, [, d]) => a + d, 0n);
      const v = await postVoucher(tx, {
        date: E,
        description: `شناسایی کارمزد اقساط — ${monthTitle(E)} (${faNum(moved.length)} برنامه)`,
        source: "INSTALLMENT",
        sourceId: `accrual:${E.toISOString().slice(0, 10)}`,
        lines,
        actor,
      });
      vouchers.push(v.id);
      total += sum;
      for (const [id, d] of moved) {
        rec.set(id, rec.get(id)! + d);
        await tx.accInstallmentPlan.update({ where: { id }, data: { recognized: { increment: d } } });
      }
    }
    months++;
    through = E;
  }
  if (through) await tx.accSettings.update({ where: { id: "singleton" }, data: { installmentAccruedThrough: through } });
  return { months, vouchers, amount: total };
}

/** ابطال برنامه: سهم شناسایی‌شده برمی‌گردد (سند کارمزد جدا باطل می‌شود) */
export async function reverseRecognized(tx: Tx, plan: { id: string; deferred: boolean; recognized: bigint }, invoice: { type: string; number: number | null; partyName: string }, why: string, actor: Actor) {
  if (!plan.deferred || plan.recognized === 0n) return null;
  await ensureInstallmentAccounts(tx);
  const label = `${invoice.type === "PURCHASE" ? "خرید" : "فروش"} ${faNum(invoice.number ?? 0)} ${invoice.partyName}`;
  return postVoucher(tx, {
    date: todayKey(),
    description: `برگشت کارمزد شناسایی‌شده‌ی اقساط ${label} — ${why}`,
    source: "INSTALLMENT",
    sourceId: `${plan.id}:void`,
    lines: recognizeLines(sideOf(invoice.type), -plan.recognized, `برگشت کارمزد اقساط ${label}`),
    actor,
  });
}

// ── تبدیل برنامه‌های قدیمی ──

/**
 * برنامه‌های پیش از ۲.۱۶۲.۰: کارمزد یک‌جا درآمد/هزینه شده بود. سهم ماه‌های نیامده (تا آخر ماه گذشته)
 * با یک سند امروز به حساب انتظار برمی‌گردد. کارمزد سال مالی قبل ← «سود (زیان) انباشته» (تعدیل سنواتی).
 */
export async function convertLegacyPlans(tx: Tx, actor: Actor, opts: { preview?: boolean; today?: Date } = {}) {
  const s = await tx.accSettings.findUnique({ where: { id: "singleton" }, select: { mode: true, installmentAccruedThrough: true } });
  if (s?.mode !== "INTERNAL") throw new AccError("فقط با حسابداری داخلی");
  const today = opts.today ?? todayKey();
  const L = lastClosedMonthEnd(today);
  const asOf = s.installmentAccruedThrough && s.installmentAccruedThrough.getTime() > L.getTime() ? s.installmentAccruedThrough : L;
  const plans = await tx.accInstallmentPlan.findMany({ where: { deferred: false, feeAmount: { gt: 0n }, voucherId: { not: null } }, include: planInclude });
  const settled = await settledSet(tx, plans);
  const thisYear = await yearForDate(tx, today);
  const rows: { planId: string; invoiceId: string; side: Side; label: string; feeDate: Date | null; fee: bigint; earned: bigint; unearned: bigint; priorYear: boolean }[] = [];
  for (const p of plans) {
    const fy = p.feeDate ? await yearForDate(tx, p.feeDate) : null;
    const earned = targetOf(p, asOf, settled.has(p.id));
    rows.push({
      planId: p.id,
      invoiceId: p.invoice.id,
      side: sideOf(p.invoice.type),
      label: planLabel(p),
      feeDate: p.feeDate,
      fee: p.feeAmount,
      earned,
      unearned: p.feeAmount - earned,
      priorYear: !!fy && !!thisYear && fy.id !== thisYear.id,
    });
  }
  const sum = (side: Side) => rows.filter((r) => r.side === side).reduce((a, r) => a + r.unearned, 0n);
  const result = { asOf, rows, sales: sum("sales"), purchase: sum("purchase"), voucherId: null as string | null };
  if (opts.preview || !rows.length) return result;
  const lines: LineInput[] = [];
  for (const r of rows) {
    if (r.unearned > 0n) lines.push(...recognizeLines(r.side, -r.unearned, `کارمزد ماه‌های آینده‌ی ${r.label}`, r.priorYear ? "RETAINED_EARNINGS" : undefined));
  }
  if (lines.length) {
    await ensureInstallmentAccounts(tx);
    const v = await postVoucher(tx, {
      date: today,
      description: `انتقال کارمزد ماه‌های آینده‌ی ${faNum(rows.filter((r) => r.unearned > 0n).length)} برنامه‌ی اقساط به حساب انتظار (شناسایی به تناسب زمان)`,
      source: "INSTALLMENT",
      sourceId: `convert:${today.toISOString().slice(0, 10)}`,
      lines,
      actor,
    });
    result.voucherId = v.id;
  }
  for (const r of rows) {
    await tx.accInstallmentPlan.update({ where: { id: r.planId }, data: { deferred: true, recognized: r.earned } });
  }
  if (!s.installmentAccruedThrough || s.installmentAccruedThrough.getTime() < asOf.getTime()) {
    await tx.accSettings.update({ where: { id: "singleton" }, data: { installmentAccruedThrough: asOf } });
  }
  return result;
}

// ── وضعیت و پیش‌بینی ──

export async function installmentIncomeStatus(db: Db, opts: { today?: Date } = {}) {
  const s = await db.accSettings.findUnique({ where: { id: "singleton" }, select: { mode: true, installmentAccruedThrough: true } });
  const today = opts.today ?? todayKey();
  const L = lastClosedMonthEnd(today);
  const plans = await db.accInstallmentPlan.findMany({ where: { feeAmount: { gt: 0n } }, include: planInclude, orderBy: { createdAt: "desc" }, take: 2000 });
  const settled = await settledSet(db, plans);
  const deferred = plans.filter((p) => p.deferred);
  const accounts = await db.accAccount.findMany({ where: { systemKey: { in: [DEFERRED_KEY, PREPAID_KEY] } }, select: { id: true, code: true, name: true, systemKey: true } });
  const bal = async (key: string, sign: 1n | -1n) => {
    const a = accounts.find((x) => x.systemKey === key);
    return a ? sign * (await balanceOf(db, { accountId: a.id })).balance : 0n;
  };

  // پیش‌بینی ۱۲ ماه آینده (از ماه جاری) — همان فرمول سند ماهانه
  const forecast: { month: string; end: Date; sales: bigint; purchase: bigint }[] = [];
  const prev = new Map(deferred.map((p) => [p.id, p.recognized]));
  let m = jalaliMonthBounds(new Date(L.getTime() + DAY));
  for (let i = 0; i < 12; i++) {
    let sales = 0n;
    let purchase = 0n;
    for (const p of deferred) {
      const t = targetOf(p, m.end, settled.has(p.id));
      const d = t - prev.get(p.id)!;
      prev.set(p.id, t);
      if (sideOf(p.invoice.type) === "sales") sales += d;
      else purchase += d;
    }
    forecast.push({ month: monthTitle(m.end), end: m.end, sales, purchase });
    m = jalaliMonthBounds(new Date(m.end.getTime() + DAY));
  }

  const rows = plans.map((p) => {
    const last = p.items[p.items.length - 1]?.dueDate ?? null;
    const sold = sideOf(p.invoice.type);
    return {
      planId: p.id,
      invoiceId: p.invoice.id,
      side: sold,
      label: planLabel(p),
      partyName: p.invoice.partyName,
      number: p.invoice.number,
      feeDate: p.feeDate,
      lastDue: last,
      fee: p.feeAmount,
      deferred: p.deferred,
      recognized: p.deferred ? p.recognized : p.feeAmount,
      remaining: p.deferred ? p.feeAmount - p.recognized : 0n,
      settled: settled.has(p.id),
    };
  });
  const open = (side: Side) => rows.filter((r) => r.deferred && r.side === side).reduce((a, r) => a + r.remaining, 0n);
  const salesBook = await bal(DEFERRED_KEY, -1n);
  const purchaseBook = await bal(PREPAID_KEY, 1n);
  const legacy = rows.filter((r) => !r.deferred && r.fee > 0n);
  return {
    mode: s?.mode ?? "NONE",
    accruedThrough: s?.installmentAccruedThrough ?? null,
    lastClosed: L,
    /** ماه گذشته هنوز سند نخورده — worker هر روز خودش می‌زند */
    behind: !!deferred.length && (!s?.installmentAccruedThrough || s.installmentAccruedThrough.getTime() < L.getTime()),
    accounts: Object.fromEntries(accounts.map((a) => [a.systemKey!, { id: a.id, code: a.code, name: a.name }])) as Record<string, { id: string; code: string; name: string }>,
    sales: { open: open("sales"), book: salesBook, diff: salesBook - open("sales") },
    purchase: { open: open("purchase"), book: purchaseBook, diff: purchaseBook - open("purchase") },
    legacy: { count: legacy.length, fee: legacy.reduce((a, r) => a + r.fee, 0n) },
    forecast,
    rows,
  };
}

export const accrualSummary = (r: { months: number; vouchers: string[]; amount: bigint; plans?: number }) =>
  r.vouchers.length
    ? `${faNum(r.vouchers.length)} سند، ${formatAmount(r.amount)} تومان کارمزد شناسایی شد`
    : r.plans === 0
      ? "برنامه‌ی اقساط کارمزدداری نیست"
      : r.months
        ? "ماه گذشته چیزی برای شناسایی نداشت"
        : "سند ماه گذشته قبلاً زده شده است";
