/**
 * فروش و خرید اقساطی — docs/plans/accounting.md بخش ۹.۳.
 *
 * برنامه روی فاکتور فروش یا خرید **صادرشده** ساخته می‌شود:
 *   مبلغ قسطی = مانده‌ی باز فاکتور − پیش‌پرداخت
 *   کارمزد (اختیاری) = سند جدا با منبع `INSTALLMENT`:
 *     فروش:  بدهکار طلب از شخص  —  بستانکار «درآمد فروش اقساطی»
 *     خرید:  بدهکار «کارمزد خرید اقساطی»  —  بستانکار بدهی به شخص
 *   جمع قسط‌ها = مبلغ قسطی + کارمزد
 * کارمزد جزو «مانده‌ی باز» فاکتور می‌شود (`invoiceOpenAmounts`)، پس هر دریافتی
 * که به فاکتور تخصیص یابد قسط‌ها را به ترتیب می‌پوشاند (`coverInstallments`).
 *
 * چک اقساط (اختیاری): یک دریافت (فروش) یا پرداخت (خرید) با یک چک برای هر قسط،
 * تخصیص‌یافته به همان فاکتور — هر قسط به چکش وصل می‌شود.
 *
 * ⚠️ ابطال برنامه: سند کارمزد باطل و ردیف حذف می‌شود؛ اگر چیزی بیش از جمع
 *    فاکتور (یعنی از کارمزد) دریافت شده، اول آن دریافت باید جدا شود.
 */

import type { AccInstallmentPlan, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatJalali } from "@/lib/club/jalali";
import { AccError } from "./errors";
import { faNum, formatAmount } from "./money";
import { todayKey } from "./dates";
import { postVoucher, rebuildVoucher, voidVoucher, type Actor } from "./ledger/post";
import { invoiceOpenAmounts } from "./cash/allocation";
import { createMoneyDoc } from "./cash/docs";
import { calcFee, coverInstallments, type FeeMode } from "./installments-calc";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export interface PlanChequeInput {
  serialNo: string;
  bankName?: string | null;
  branch?: string | null;
  sayadId?: string | null;
  /** خرید: حساب بانکی که چک از آن صادر می‌شود */
  treasuryId?: string | null;
  chequeBookId?: string | null;
}

export interface PlanInput {
  downPayment: bigint;
  feeMode: FeeMode;
  feeRateBp: number;
  /** FIXED: مبلغ کارمزد؛ بقیه‌ی حالت‌ها از روی درصد حساب می‌شود */
  feeAmount?: bigint;
  intervalMonths: number;
  items: { dueDate: Date; amount: bigint }[];
  /** چک هر قسط به همان ترتیب — خالی یعنی بی‌چک */
  cheques?: (PlanChequeInput | null)[] | null;
  /** تاریخ ثبت کارمزد و چک‌ها — پیش‌فرض امروز */
  date?: Date | null;
  note?: string | null;
}

const SIDE = { SALES: "sales", PURCHASE: "purchase" } as const;

function validate(input: PlanInput) {
  if (!input.items.length) throw new AccError("دست‌کم یک قسط لازم است");
  if (input.items.length > 120) throw new AccError("بیش از ۱۲۰ قسط مجاز نیست");
  if (!Number.isInteger(input.intervalMonths) || input.intervalMonths < 1 || input.intervalMonths > 12) throw new AccError("فاصله‌ی اقساط بین ۱ تا ۱۲ ماه است");
  if (input.downPayment < 0n) throw new AccError("پیش‌پرداخت منفی نمی‌شود");
  if (!Number.isInteger(input.feeRateBp) || input.feeRateBp < 0 || input.feeRateBp > 10000) throw new AccError("درصد کارمزد نامعتبر است");
  input.items.forEach((it, i) => {
    if (it.amount <= 0n) throw new AccError(`قسط ${faNum(i + 1)}: مبلغ باید بیشتر از صفر باشد`);
    if (i > 0 && it.dueDate.getTime() < input.items[i - 1].dueDate.getTime()) throw new AccError(`قسط ${faNum(i + 1)}: سررسید نباید پیش از قسط قبلی باشد`);
  });
}

async function feeVoucherLines(side: "sales" | "purchase", partyId: string, fee: bigint) {
  return side === "sales"
    ? [
        { accountKey: "AR", partyId, debit: fee, description: "کارمزد فروش اقساطی" },
        { accountKey: "INSTALLMENT_INCOME", credit: fee, description: "کارمزد فروش اقساطی" },
      ]
    : [
        { accountKey: "INSTALLMENT_EXPENSE", debit: fee, description: "کارمزد خرید اقساطی" },
        { accountKey: "AP", partyId, credit: fee, description: "کارمزد خرید اقساطی" },
      ];
}

export async function createPlan(tx: Tx, invoiceId: string, input: PlanInput, actor: Actor): Promise<AccInstallmentPlan> {
  validate(input);
  await tx.$queryRaw`SELECT id FROM "AccInvoice" WHERE id = ${invoiceId} FOR UPDATE`;
  const inv = await tx.accInvoice.findUnique({ where: { id: invoiceId }, include: { installmentPlan: true } });
  if (!inv) throw new AccError("فاکتور پیدا نشد", 404);
  if (inv.status !== "ISSUED") throw new AccError("فقط فاکتور صادرشده قسطی می‌شود");
  const side = SIDE[inv.type as keyof typeof SIDE];
  if (!side) throw new AccError("فقط فاکتور فروش یا خرید قسطی می‌شود");
  if (inv.installmentPlan) throw new AccError("این فاکتور برنامه‌ی اقساط دارد؛ برای تغییر، زمان‌بندی را ویرایش یا برنامه را باطل کنید", 409);

  const open = (await invoiceOpenAmounts(tx, [inv.id])).get(inv.id)!.open;
  const principal = open - input.downPayment;
  if (principal <= 0n) throw new AccError(`مانده‌ی فاکتور ${formatAmount(open)} است؛ پیش‌پرداخت باید کمتر از آن باشد`);
  const count = input.items.length;
  const fee = input.feeMode === "FIXED" ? input.feeAmount ?? 0n : calcFee(principal, input.feeMode, input.feeRateBp, count, input.intervalMonths);
  if (fee < 0n) throw new AccError("کارمزد منفی نمی‌شود");
  const sum = input.items.reduce((s, i) => s + i.amount, 0n);
  if (sum !== principal + fee) {
    throw new AccError(`جمع قسط‌ها (${formatAmount(sum)}) باید برابر مبلغ قسطی + کارمزد (${formatAmount(principal + fee)}) باشد`);
  }
  if (input.items[0].dueDate.getTime() < inv.date.getTime()) throw new AccError("سررسید اولین قسط پیش از تاریخ فاکتور است");
  const date = input.date ?? todayKey();

  let plan = await tx.accInstallmentPlan.create({
    data: {
      invoiceId: inv.id,
      partyId: inv.partyId,
      downPayment: input.downPayment,
      principal,
      feeMode: fee > 0n ? input.feeMode : "NONE",
      feeRateBp: fee > 0n && input.feeMode !== "FIXED" ? input.feeRateBp : 0,
      feeAmount: fee,
      count,
      intervalMonths: input.intervalMonths,
      note: input.note?.trim() || null,
      createdById: actor.id ?? null,
      createdByName: actor.name,
      items: { create: input.items.map((it, i) => ({ seq: i + 1, dueDate: it.dueDate, amount: it.amount })) },
    },
  });
  const label = inv.type === "SALES" ? "فروش" : "خرید";
  if (fee > 0n) {
    const v = await postVoucher(tx, {
      date,
      description: `کارمزد ${label} اقساطی — فاکتور ${faNum(inv.number ?? 0)} ${inv.partyName} (${faNum(count)} قسط)`,
      source: "INSTALLMENT",
      sourceId: plan.id,
      lines: await feeVoucherLines(side, inv.partyId, fee),
      actor,
    });
    plan = await tx.accInstallmentPlan.update({ where: { id: plan.id }, data: { voucherId: v.id } });
  }

  // چک اقساط — یک دریافت/پرداخت با یک چک برای هر قسط
  const cheques = input.cheques ?? [];
  if (cheques.some((c) => c && c.serialNo?.trim())) {
    const items = await tx.accInstallment.findMany({ where: { planId: plan.id }, orderBy: { seq: "asc" } });
    const withCheque = items.map((it, i) => ({ it, c: cheques[i] })).filter((x): x is { it: (typeof items)[number]; c: PlanChequeInput } => !!x.c && !!x.c.serialNo?.trim());
    const doc = await createMoneyDoc(
      tx,
      {
        kind: side === "sales" ? "RECEIPT" : "PAYMENT",
        date,
        partyId: inv.partyId,
        description: `چک‌های اقساط فاکتور ${faNum(inv.number ?? 0)}`,
        items: withCheque.map(({ it, c }) => ({
          method: "CHEQUE" as const,
          amount: it.amount,
          treasuryId: side === "purchase" ? c.treasuryId ?? null : null,
          cheque: {
            serialNo: c.serialNo,
            bankName: c.bankName ?? null,
            branch: c.branch ?? null,
            sayadId: c.sayadId ?? null,
            dueDate: it.dueDate,
            chequeBookId: c.chequeBookId ?? null,
            note: `قسط ${faNum(it.seq)} از ${faNum(count)}`,
          },
        })),
        allocations: [{ invoiceId: inv.id, amount: withCheque.reduce((s, x) => s + x.it.amount, 0n) }],
      },
      actor,
    );
    const made = await tx.accMoneyItem.findMany({ where: { moneyDocId: doc.id }, orderBy: { seq: "asc" }, select: { chequeId: true } });
    for (const [k, x] of withCheque.entries()) {
      await tx.accInstallment.update({ where: { id: x.it.id }, data: { chequeId: made[k]?.chequeId ?? null } });
    }
  }
  return plan;
}

/** زمان‌بندی تازه — همان جمع، همان کارمزد. چک هر قسط به همان شماره‌ی قسط وصل می‌ماند. */
export async function reschedulePlan(tx: Tx, planId: string, items: { dueDate: Date; amount: bigint }[], actor: Actor): Promise<void> {
  const plan = await tx.accInstallmentPlan.findUnique({ where: { id: planId }, include: { items: { orderBy: { seq: "asc" } } } });
  if (!plan) throw new AccError("برنامه پیدا نشد", 404);
  validate({ downPayment: 0n, feeMode: "NONE", feeRateBp: 0, intervalMonths: plan.intervalMonths, items });
  const sum = items.reduce((s, i) => s + i.amount, 0n);
  if (sum !== plan.principal + plan.feeAmount) {
    throw new AccError(`جمع قسط‌ها باید همان ${formatAmount(plan.principal + plan.feeAmount)} بماند`);
  }
  const cheques = new Map(plan.items.map((i) => [i.seq, i.chequeId]));
  for (const [i, it] of plan.items.entries()) {
    if (it.chequeId && (i >= items.length || items[i].amount !== it.amount)) {
      throw new AccError(`قسط ${faNum(it.seq)} چک دارد؛ مبلغش عوض نمی‌شود (سررسید چک هم از صفحه‌ی خود چک)`);
    }
  }
  await tx.accInstallment.deleteMany({ where: { planId } });
  await tx.accInstallment.createMany({
    data: items.map((it, i) => ({ planId, seq: i + 1, dueDate: it.dueDate, amount: it.amount, chequeId: cheques.get(i + 1) ?? null })),
  });
  await tx.accInstallmentPlan.update({ where: { id: planId }, data: { count: items.length } });
  void actor;
}

export async function voidPlan(tx: Tx, planId: string, reason: string, actor: Actor): Promise<AccInstallmentPlan> {
  if (!reason.trim()) throw new AccError("دلیل ابطال را بنویسید");
  const plan = await tx.accInstallmentPlan.findUnique({ where: { id: planId }, include: { invoice: true } });
  if (!plan) throw new AccError("برنامه پیدا نشد", 404);
  const o = (await invoiceOpenAmounts(tx, [plan.invoiceId])).get(plan.invoiceId)!;
  if (o.paid > o.total - o.returned) {
    throw new AccError(
      `از این فاکتور ${formatAmount(o.paid)} دریافت شده که ${formatAmount(o.paid - (o.total - o.returned))} آن کارمزد است؛ اول تخصیص آن دریافت را کم کنید`,
      409,
    );
  }
  if (plan.voucherId) await voidVoucher(tx, plan.voucherId, `ابطال برنامه‌ی اقساط: ${reason.trim()}`, actor, { fromSource: true });
  await tx.accInstallmentPlan.delete({ where: { id: planId } });
  return plan;
}

/** بازسازی سند کارمزد — اگر تاریخ یا شخص فاکتور بعداً عوض شد (فعلاً فقط برای کامل بودن) */
export async function rebuildFeeVoucher(tx: Tx, planId: string, actor: Actor): Promise<void> {
  const plan = await tx.accInstallmentPlan.findUnique({ where: { id: planId }, include: { invoice: true } });
  if (!plan?.voucherId || plan.feeAmount <= 0n) return;
  const side = SIDE[plan.invoice.type as keyof typeof SIDE];
  const v = await tx.accVoucher.findUnique({ where: { id: plan.voucherId } });
  if (!v) return;
  await rebuildVoucher(tx, v.id, { date: v.date, description: v.description, lines: await feeVoucherLines(side, plan.invoice.partyId, plan.feeAmount), actor });
}

// ── وضعیت ──

export interface InstallmentRow {
  id: string;
  planId: string;
  seq: number;
  count: number;
  dueDate: Date;
  amount: bigint;
  paid: bigint;
  left: bigint;
  state: ReturnType<typeof coverInstallments>[number]["state"];
  cheque: { id: string; serialNo: string; status: string; direction: string } | null;
  invoice: { id: string; type: string; number: number | null; date: Date };
  party: { id: string; name: string; mobile: string | null };
}

/** وضعیت همه‌ی قسط‌های چند برنامه — پوشش از تخصیص‌های فاکتور */
export async function planRows(db: Db, where: Prisma.AccInstallmentPlanWhereInput): Promise<InstallmentRow[]> {
  const plans = await db.accInstallmentPlan.findMany({
    where,
    include: {
      items: { orderBy: { seq: "asc" } },
      invoice: { select: { id: true, type: true, number: true, date: true, total: true } },
      party: { select: { id: true, name: true, mobile: true } },
    },
    take: 2000,
  });
  if (!plans.length) return [];
  const open = await invoiceOpenAmounts(db as Tx, plans.map((p) => p.invoiceId));
  const chequeIds = plans.flatMap((p) => p.items.map((i) => i.chequeId)).filter((x): x is string => !!x);
  const cheques = new Map(
    (chequeIds.length ? await db.accCheque.findMany({ where: { id: { in: chequeIds } }, select: { id: true, serialNo: true, status: true, direction: true } }) : []).map((c) => [c.id, c]),
  );
  const today = todayKey();
  const out: InstallmentRow[] = [];
  for (const p of plans) {
    const o = open.get(p.invoiceId);
    const head = p.invoice.total + p.feeAmount - (p.principal + p.feeAmount); // = جمع فاکتور − مبلغ قسطی
    const cov = coverInstallments(p.items, { head, paid: o?.paid ?? 0n, returned: o?.returned ?? 0n, today });
    p.items.forEach((it, k) => {
      const c = it.chequeId ? cheques.get(it.chequeId) ?? null : null;
      out.push({
        id: it.id,
        planId: p.id,
        seq: it.seq,
        count: p.items.length,
        dueDate: it.dueDate,
        amount: cov[k].amount,
        paid: cov[k].paid,
        left: cov[k].left,
        state: cov[k].state,
        cheque: c,
        invoice: { id: p.invoice.id, type: p.invoice.type, number: p.invoice.number, date: p.invoice.date },
        party: p.party,
      });
    });
  }
  return out;
}

export async function planOfInvoice(db: Db, invoiceId: string) {
  const plan = await db.accInstallmentPlan.findUnique({ where: { invoiceId } });
  if (!plan) return null;
  const rows = await planRows(db, { id: plan.id });
  return { plan, rows };
}

export const planSummaryText = (p: { count: number; principal: bigint; feeAmount: bigint }, first: Date) =>
  `${faNum(p.count)} قسط از ${formatJalali(first)} — ${formatAmount(p.principal + p.feeAmount)} تومان`;
