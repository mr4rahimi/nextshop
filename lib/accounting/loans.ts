/**
 * وام و تسهیلات دریافتی — docs/plans/webhesab-parity.md بخش ۲۱.
 *
 * دریافت:  بدهکار بانک (خالص) + کارمزد بانکی (کارمزد اول کار) — بستانکار تسهیلات دریافتی
 * قسط:     بدهکار تسهیلات دریافتی (اصل) + سود و جریمه — بستانکار بانک
 * وام قدیمی (`existing`) سند دریافت ندارد؛ مانده‌اش از مانده‌های اول دوره می‌آید.
 */

import type { AccLoan, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError, toAmount } from "./errors";
import { faNum, formatAmount } from "./money";
import { parseDay, todayKey } from "./dates";
import { postVoucher, voidVoucher, type Actor } from "./ledger/post";
import { TREASURY_ACCOUNT_KEY } from "./treasury";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export interface LoanBody {
  title?: string;
  lender?: string;
  date?: string;
  treasuryId?: string | null;
  existing?: boolean;
  principal?: unknown;
  upfrontFee?: unknown;
  rateBp?: number;
  intervalMonths?: number;
  note?: string | null;
  items?: { dueDate?: string; principal?: unknown; interest?: unknown }[];
}

async function activeTreasury(tx: Tx, id: string) {
  const t = await tx.accTreasury.findUnique({ where: { id } });
  if (!t) throw new AccError("صندوق یا بانک پیدا نشد", 404);
  if (!t.isActive) throw new AccError(`«${t.name}» غیرفعال است`);
  return t;
}

export async function createLoan(tx: Tx, b: LoanBody, actor: Actor): Promise<AccLoan> {
  const title = String(b.title ?? "").trim();
  if (!title) throw new AccError("عنوان وام را بنویسید");
  const lender = String(b.lender ?? "").trim();
  if (!lender) throw new AccError("وام‌دهنده را بنویسید");
  const date = parseDay(b.date);
  if (!date) throw new AccError("تاریخ وام را انتخاب کنید");
  const principal = toAmount(b.principal, "مبلغ وام");
  if (principal <= 0n) throw new AccError("مبلغ وام را وارد کنید");
  const existing = b.existing === true;
  const upfrontFee = existing ? 0n : toAmount(b.upfrontFee, "کارمزد");
  if (upfrontFee < 0n || upfrontFee >= principal) throw new AccError("کارمزد اول کار باید از مبلغ وام کمتر باشد");
  const rateBp = Number(b.rateBp ?? 0);
  if (!Number.isInteger(rateBp) || rateBp < 0 || rateBp > 20000) throw new AccError("نرخ سود نامعتبر است");
  const intervalMonths = Number(b.intervalMonths ?? 1);
  if (!Number.isInteger(intervalMonths) || intervalMonths < 1 || intervalMonths > 12) throw new AccError("فاصله‌ی اقساط بین ۱ تا ۱۲ ماه است");

  if (!Array.isArray(b.items) || !b.items.length) throw new AccError("جدول اقساط خالی است");
  if (b.items.length > 240) throw new AccError("بیش از ۲۴۰ قسط مجاز نیست");
  let prev = date;
  let sum = 0n;
  const items = b.items.map((it, i) => {
    const at = `قسط ${faNum(i + 1)}`;
    const dueDate = parseDay(it.dueDate);
    if (!dueDate) throw new AccError(`${at}: سررسید را انتخاب کنید`);
    if (dueDate.getTime() < prev.getTime()) throw new AccError(`${at}: سررسید نباید پیش از ${i ? "قسط قبلی" : "تاریخ وام"} باشد`);
    prev = dueDate;
    const p = toAmount(it.principal, `${at}: اصل`);
    const interest = toAmount(it.interest, `${at}: سود`);
    if (p < 0n || interest < 0n) throw new AccError(`${at}: مبلغ منفی مجاز نیست`);
    if (p + interest === 0n) throw new AccError(`${at}: مبلغ صفر است`);
    sum += p;
    return { seq: i + 1, dueDate, principal: p, interest };
  });
  if (sum !== principal) throw new AccError(`جمع اصل اقساط (${formatAmount(sum)}) باید برابر مبلغ وام (${formatAmount(principal)}) باشد`);

  const treasury = existing ? null : b.treasuryId ? await activeTreasury(tx, b.treasuryId) : null;
  if (!existing && !treasury) throw new AccError("حسابی که وام به آن واریز شده را انتخاب کنید");

  const loan = await tx.accLoan.create({
    data: {
      title,
      lender,
      date,
      principal,
      upfrontFee,
      rateBp,
      intervalMonths,
      treasuryId: treasury?.id ?? null,
      note: b.note?.trim() || null,
      createdById: actor.id ?? null,
      createdByName: actor.name,
      items: { create: items },
    },
  });
  if (!treasury) return loan;

  const v = await postVoucher(tx, {
    date,
    description: `دریافت وام ${faNum(loan.number)} — ${title} (${lender})`,
    source: "LOAN",
    sourceId: loan.id,
    lines: [
      { accountKey: TREASURY_ACCOUNT_KEY[treasury.kind], treasuryId: treasury.id, debit: principal - upfrontFee },
      ...(upfrontFee > 0n ? [{ accountKey: "BANK_FEE", debit: upfrontFee, description: "کارمزد اول کار وام" }] : []),
      { accountKey: "LOAN_PAYABLE", credit: principal },
    ],
    actor,
  });
  return tx.accLoan.update({ where: { id: loan.id }, data: { voucherId: v.id } });
}

async function lockLoan(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "AccLoan" WHERE id = ${id} FOR UPDATE`;
  const loan = await tx.accLoan.findUnique({ where: { id }, include: { items: { orderBy: { seq: "asc" } } } });
  if (!loan) throw new AccError("وام پیدا نشد", 404);
  return loan;
}

export async function payInstallment(tx: Tx, loanId: string, seq: number, input: { date: Date; treasuryId: string; penalty: bigint }, actor: Actor) {
  const loan = await lockLoan(tx, loanId);
  if (loan.status !== "ACTIVE") throw new AccError(loan.status === "VOID" ? "این وام باطل شده است" : "این وام تسویه شده است", 409);
  const it = loan.items.find((x) => x.seq === seq);
  if (!it) throw new AccError("قسط پیدا نشد", 404);
  if (it.paidAt) throw new AccError("این قسط قبلاً پرداخت شده است", 409);
  if (input.penalty < 0n) throw new AccError("جریمه منفی نمی‌شود");
  if (!input.treasuryId) throw new AccError("صندوق یا بانک پرداخت را انتخاب کنید");
  const t = await activeTreasury(tx, input.treasuryId);

  const expense = it.interest + input.penalty;
  const v = await postVoucher(tx, {
    date: input.date,
    description: `قسط ${faNum(seq)} وام ${faNum(loan.number)} — ${loan.title} (${loan.lender})`,
    source: "LOAN",
    sourceId: `${loan.id}:${seq}`,
    lines: [
      ...(it.principal > 0n ? [{ accountKey: "LOAN_PAYABLE", debit: it.principal, description: "اصل قسط" }] : []),
      ...(expense > 0n ? [{ accountKey: "LOAN_INTEREST", debit: expense, description: input.penalty > 0n ? "سود و جریمه‌ی قسط" : "سود قسط" }] : []),
      { accountKey: TREASURY_ACCOUNT_KEY[t.kind], treasuryId: t.id, credit: it.principal + expense },
    ],
    actor,
  });
  await tx.accLoanInstallment.update({ where: { id: it.id }, data: { paidAt: input.date, penalty: input.penalty, treasuryId: t.id, voucherId: v.id, paidByName: actor.name } });
  if (loan.items.every((x) => x.paidAt || x.id === it.id)) await tx.accLoan.update({ where: { id: loan.id }, data: { status: "SETTLED" } });
  return v;
}

export async function unpayInstallment(tx: Tx, loanId: string, seq: number, actor: Actor): Promise<void> {
  const loan = await lockLoan(tx, loanId);
  if (loan.status === "VOID") throw new AccError("این وام باطل شده است", 409);
  const it = loan.items.find((x) => x.seq === seq);
  if (!it) throw new AccError("قسط پیدا نشد", 404);
  if (!it.paidAt || !it.voucherId) throw new AccError("این قسط پرداخت نشده است", 409);
  await voidVoucher(tx, it.voucherId, `برگشت پرداخت قسط ${faNum(seq)} وام ${faNum(loan.number)}`, actor, { fromSource: true });
  await tx.accLoanInstallment.update({ where: { id: it.id }, data: { paidAt: null, penalty: 0n, treasuryId: null, voucherId: null, paidByName: null } });
  if (loan.status === "SETTLED") await tx.accLoan.update({ where: { id: loan.id }, data: { status: "ACTIVE" } });
}

export async function voidLoan(tx: Tx, loanId: string, reason: string, actor: Actor): Promise<void> {
  const loan = await lockLoan(tx, loanId);
  if (loan.status === "VOID") return;
  if (!reason.trim()) throw new AccError("دلیل ابطال را بنویسید");
  if (loan.items.some((x) => x.paidAt)) throw new AccError("این وام قسط پرداخت‌شده دارد؛ اول پرداخت‌ها را برگردانید", 409);
  if (loan.voucherId) await voidVoucher(tx, loan.voucherId, reason, actor, { fromSource: true });
  await tx.accLoan.update({ where: { id: loan.id }, data: { status: "VOID", voidReason: `${reason.trim()} — ${actor.name}` } });
}

type LoanWithItems = AccLoan & { items: { principal: bigint; interest: bigint; penalty: bigint; paidAt: Date | null; dueDate: Date }[] };

function loanStats(l: LoanWithItems, today: Date) {
  let paidPrincipal = 0n;
  let paidTotal = 0n;
  let paidCount = 0;
  let remaining = 0n;
  let remainingInterest = 0n;
  let overdue = 0;
  let nextDue: Date | null = null;
  for (const i of l.items) {
    if (i.paidAt) {
      paidPrincipal += i.principal;
      paidTotal += i.principal + i.interest + i.penalty;
      paidCount++;
    } else {
      remaining += i.principal;
      remainingInterest += i.interest;
      if (i.dueDate.getTime() < today.getTime()) overdue++;
      if (!nextDue || i.dueDate.getTime() < nextDue.getTime()) nextDue = i.dueDate;
    }
  }
  return { paidPrincipal, paidTotal, paidCount, count: l.items.length, remaining, remainingInterest, overdue, nextDue };
}

export async function listLoans(db: Db) {
  const today = todayKey();
  const loans = await db.accLoan.findMany({ orderBy: { number: "desc" }, include: { items: { orderBy: { seq: "asc" } } } });
  const live = loans.filter((l) => l.status === "ACTIVE");
  const stats = new Map(loans.map((l) => [l.id, loanStats(l, today)]));
  const installments = live
    .flatMap((l) => l.items.filter((i) => !i.paidAt).map((i) => ({ id: i.id, seq: i.seq, dueDate: i.dueDate, principal: i.principal, interest: i.interest, overdue: i.dueDate.getTime() < today.getTime(), loan: { id: l.id, number: l.number, title: l.title, lender: l.lender } })))
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  return {
    today,
    loans: loans.map(({ items: _items, ...l }) => ({ ...l, ...stats.get(l.id)! })),
    installments,
    totals: {
      remaining: live.reduce((s, l) => s + stats.get(l.id)!.remaining, 0n),
      overdue: installments.filter((i) => i.overdue).length,
      nextAmount: installments[0] ? installments[0].principal + installments[0].interest : 0n,
      nextDue: installments[0]?.dueDate ?? null,
    },
  };
}

export async function getLoan(db: Db, id: string) {
  const loan = await db.accLoan.findUnique({
    where: { id },
    include: { treasury: { select: { id: true, name: true } }, items: { orderBy: { seq: "asc" }, include: { treasury: { select: { id: true, name: true } } } } },
  });
  if (!loan) throw new AccError("وام پیدا نشد", 404);
  const today = todayKey();
  return { loan, today, stats: loanStats(loan, today) };
}
