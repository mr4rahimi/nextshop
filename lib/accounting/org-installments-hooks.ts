/**
 * اقساط سازمانی — قلاب‌هایی که `cash/docs.ts` صدا می‌زند (جدا از `org-installments.ts` تا وابستگی چرخشی نشود).
 * docs/plans/org-installments.md.
 */

import type { Prisma } from "@prisma/client";
import { AccError } from "./errors";
import { createAccount } from "./ledger/accounts";
import type { Actor } from "./ledger/post";
import { faNum } from "./money";

type Tx = Prisma.TransactionClient;

export const ORG_FEE_KEY = "ORG_INSTALLMENT_FEE";

/** حساب «کارمزد فروش اقساطی سازمانی» — مهاجرت برای سرفصل‌های دارای ۸۱ ساخته؛ بقیه این‌جا */
export async function ensureOrgFeeAccount(tx: Tx) {
  const hit = await tx.accAccount.findUnique({ where: { systemKey: ORG_FEE_KEY } });
  if (hit) return hit;
  const parent =
    (await tx.accAccount.findFirst({ where: { code: "81", level: "LEDGER" } })) ??
    (await tx.accAccount.findFirst({ where: { class: "EXPENSE", level: "LEDGER" }, orderBy: { code: "asc" } }));
  if (!parent) throw new AccError("سرفصل هزینه‌ها پیدا نشد؛ حساب «کارمزد فروش اقساطی سازمانی» را دستی زیر هزینه‌های فروش بسازید");
  const acc = await createAccount(tx, { parentId: parent.id, name: "کارمزد فروش اقساطی سازمانی" });
  return tx.accAccount.update({ where: { id: acc.id }, data: { systemKey: ORG_FEE_KEY, nature: "DEBIT", detailKind: "NONE" } });
}

/** «پرداخت‌شده» هر قسط = دریافتیِ وب حساب (legacyPaid) + Σ ردیف‌های تسویه‌ی زنده؛ وضعیت قرارداد از روی آن */
export async function recalcOrgInstallments(tx: Tx, installmentIds: string[]) {
  if (!installmentIds.length) return;
  const sums = await tx.accOrgSettlementLine.groupBy({ by: ["installmentId"], where: { installmentId: { in: installmentIds }, settlement: { voidedAt: null } }, _sum: { amount: true } });
  const by = new Map(sums.map((x) => [x.installmentId, x._sum.amount ?? 0n]));
  const items = await tx.accOrgInstallment.findMany({ where: { id: { in: installmentIds } }, select: { id: true, contractId: true, legacyPaid: true } });
  for (const i of items) await tx.accOrgInstallment.update({ where: { id: i.id }, data: { paid: i.legacyPaid + (by.get(i.id) ?? 0n) } });
  const contractIds = [...new Set(items.map((i) => i.contractId))];
  for (const cid of contractIds) {
    const c = await tx.accOrgContract.findUnique({ where: { id: cid }, include: { items: true } });
    if (!c || c.status === "VOID") continue;
    const done = c.items.every((x) => x.paid >= x.amount);
    if (done !== (c.status === "DONE")) await tx.accOrgContract.update({ where: { id: cid }, data: { status: done ? "DONE" : "ACTIVE" } });
  }
}

/** ابطال یک دریافت: قرارداد (فقط بی قسط دریافت‌شده) یا تسویه‌ی ماهانه‌ی سازمان */
export async function onMoneyDocVoid(tx: Tx, moneyDocId: string, reason: string, actor: Actor) {
  const c = await tx.accOrgContract.findUnique({ where: { moneyDocId }, include: { items: true } });
  if (c && c.status !== "VOID") {
    const paid = c.items.reduce((s, x) => s + x.paid - x.legacyPaid, 0n);
    if (paid > 0n) throw new AccError(`از قرارداد اقساط ${faNum(c.number)} قسط دریافت شده؛ اول دریافت‌های سازمان را اصلاح کنید`, 409);
    await tx.accOrgContract.update({ where: { id: c.id }, data: { status: "VOID", voidReason: `${reason} — ${actor.name}` } });
  }
  const st = await tx.accOrgSettlement.findUnique({ where: { moneyDocId }, include: { lines: true } });
  if (st && !st.voidedAt) {
    await tx.accOrgSettlement.update({ where: { id: st.id }, data: { voidedAt: new Date(), voidReason: `${reason} — ${actor.name}` } });
    await recalcOrgInstallments(tx, st.lines.map((l) => l.installmentId));
  }
}
