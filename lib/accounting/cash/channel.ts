/**
 * ثبت خودکار پول از بخش‌های فروشگاه (docs/plans/accounting.md بخش ۹.۱ و فاز ۶):
 *
 * - `PAYMENT_RECEIVED`: `Payment` موفق ← دریافت روی صندوق/بانک/درگاهی که
 *   `providers` آن شامل `Payment.provider` است. پرداخت از کیف پول (`WALLET`)
 *   روش «کیف پول» می‌گیرد: بدهی فروشگاه به همان مشتری کم می‌شود.
 * - `INSTALLMENT_PAID`: «پرداخت شد» قسط اعتباری در کارتابل ← دریافت روی
 *   صندوق/بانکِ تنظیمات (`installmentTreasuryId`).
 * - `COMMISSION_PAID`: تسویه‌ی پورسانت (`StaffPayout`) ← هزینه‌ی پورسانت به
 *   نام کارمند از صندوق/بانکِ تنظیمات (`payoutTreasuryId`).
 *
 * دریافت‌ها به فاکتور فروش همان سفارش تخصیص می‌یابند. رویداد روی aggregate
 * سفارش است، پس بعد از فاکتور فروش اجرا می‌شود.
 *
 * ⚠️ اعتباری (`credit`) دریافت نمی‌سازد — رکورد پرداختش فقط «بسته شدن بدهی»
 *    است و پول واقعی با هر قسط جدا ثبت می‌شود.
 * ⚠️ صندوقِ تنظیم‌نشده ← رویداد «مسدود» با پیام؛ بعد از تنظیم خودش ثبت می‌شود.
 */

import type { AccMoneyDoc, AccMoneyMethod, AccTreasury, AccTreasuryKind, Prisma } from "@prisma/client";
import { AccError } from "../errors";
import { dayKey } from "../dates";
import { accountByKey } from "../ledger/accounts";
import { faNum } from "../money";
import { partyForEmployee, partyForUser } from "../parties";
import { AUTO_ACTOR, orderSaleKey } from "../invoices/channel";
import { invoiceOpenAmounts } from "./allocation";
import { createMoneyDoc } from "./docs";

type Tx = Prisma.TransactionClient;

/** درگاه‌هایی که دریافت خودکار نمی‌سازند */
export const SKIP_PROVIDERS = ["credit"];
export const paymentKey = (paymentId: string) => `payment:${paymentId}`;
export const installmentKey = (installmentId: string) => `installment:${installmentId}`;
export const payoutKey = (payoutId: string) => `payout:${payoutId}`;

const METHOD_OF: Record<AccTreasuryKind, AccMoneyMethod> = { CASH: "CASH", BANK: "BANK_TRANSFER", POS: "POS", GATEWAY: "GATEWAY" };

/** تخصیص به فاکتور فروش سفارش، تا سقف مانده‌اش — نبود فاکتور یعنی پیش‌دریافت */
async function allocToOrderSale(tx: Tx, orderId: string, amount: bigint) {
  const sale = await tx.accInvoice.findUnique({ where: { sourceKey: orderSaleKey(orderId) }, select: { id: true, status: true } });
  if (sale?.status !== "ISSUED") return [];
  const open = (await invoiceOpenAmounts(tx, [sale.id])).get(sale.id)?.open ?? 0n;
  const a = open < amount ? open : amount;
  return a > 0n ? [{ invoiceId: sale.id, amount: a }] : [];
}

/** صندوق/بانکِ ثبت خودکار از تنظیمات — نبودش خطای «مسدود» با راه حل */
async function settingTreasury(tx: Tx, key: "installmentTreasuryId" | "payoutTreasuryId", what: string): Promise<AccTreasury> {
  const s = await tx.accSettings.findUnique({ where: { id: "singleton" }, select: { installmentTreasuryId: true, payoutTreasuryId: true } });
  const id = s?.[key];
  const t = id ? await tx.accTreasury.findUnique({ where: { id } }) : null;
  if (!t || !t.isActive) {
    throw new AccError(`${what} روی کدام صندوق یا بانک ثبت شود؟ در «تنظیمات حسابداری ← ثبت خودکار» انتخاب کنید`);
  }
  return t;
}

export async function receiptFromPayment(tx: Tx, paymentId: string, at: Date): Promise<AccMoneyDoc | null> {
  const existing = await tx.accMoneyDoc.findUnique({ where: { sourceKey: paymentKey(paymentId) } });
  if (existing) return existing;
  const p = await tx.payment.findUnique({ where: { id: paymentId }, include: { order: { select: { id: true, userId: true, orderNumber: true } } } });
  if (!p) throw new AccError("پرداخت پیدا نشد", 404);
  const provider = (p.provider ?? "").trim();
  if (p.status !== "SUCCEEDED" || p.amount <= 0n || SKIP_PROVIDERS.includes(provider.toLowerCase())) return null;
  const party = await partyForUser(tx, p.order.userId);

  if (provider.toUpperCase() === "WALLET") {
    return createMoneyDoc(
      tx,
      {
        kind: "RECEIPT",
        date: dayKey(at),
        partyId: party.id,
        description: `پرداخت سفارش ${p.order.orderNumber} از کیف پول`,
        items: [{ method: "WALLET", amount: p.amount }],
        allocations: await allocToOrderSale(tx, p.order.id, p.amount),
        paymentId: p.id,
        sourceKey: paymentKey(p.id),
      },
      AUTO_ACTOR,
    );
  }

  const treasuries = await tx.accTreasury.findMany({ where: { isActive: true, providers: { has: provider } }, orderBy: { code: "asc" } });
  const t = treasuries[0];
  if (!t) {
    throw new AccError(
      `پرداخت «${provider || "بی‌نام"}» سفارش ${p.order.orderNumber} به هیچ صندوق یا بانکی وصل نیست — در «صندوق و بانک» روی حساب مقصد، «${provider}» را در درگاه‌های سایت بنویسید`,
    );
  }
  const allocations = await allocToOrderSale(tx, p.order.id, p.amount);

  return createMoneyDoc(
    tx,
    {
      kind: "RECEIPT",
      date: dayKey(at),
      partyId: party.id,
      description: `پرداخت سفارش ${p.order.orderNumber}`,
      items: [{ method: METHOD_OF[t.kind], treasuryId: t.id, amount: p.amount, trackingCode: p.providerRef }],
      allocations,
      paymentId: p.id,
      sourceKey: paymentKey(p.id),
    },
    AUTO_ACTOR,
  );
}

/** واریز یک قسط اعتباری — «پرداخت شد» در کارتابل */
export async function receiptFromInstallment(tx: Tx, installmentId: string, at: Date): Promise<AccMoneyDoc | null> {
  const existing = await tx.accMoneyDoc.findUnique({ where: { sourceKey: installmentKey(installmentId) } });
  if (existing) return existing;
  const inst = await tx.orderCreditInstallment.findUnique({
    where: { id: installmentId },
    include: { order: { select: { id: true, userId: true, orderNumber: true } } },
  });
  if (!inst) throw new AccError("قسط پیدا نشد", 404);
  const amount = inst.paidAmount ?? 0n;
  if (inst.status !== "PAID" || amount <= 0n) return null;

  const t = await settingTreasury(tx, "installmentTreasuryId", `واریز قسط سفارش ${inst.order.orderNumber}`);
  const party = await partyForUser(tx, inst.order.userId);
  return createMoneyDoc(
    tx,
    {
      kind: "RECEIPT",
      date: dayKey(inst.paidAt ?? at),
      partyId: party.id,
      description: `قسط ${faNum(inst.seq)} سفارش ${inst.order.orderNumber}${inst.paidNote ? ` — ${inst.paidNote}` : ""}`.slice(0, 500),
      items: [{ method: METHOD_OF[t.kind], treasuryId: t.id, amount }],
      allocations: await allocToOrderSale(tx, inst.order.id, amount),
      sourceKey: installmentKey(installmentId),
    },
    { id: inst.confirmedById, name: inst.confirmedByName ?? AUTO_ACTOR.name },
  );
}

/** تسویه‌ی پورسانت ← هزینه‌ی «پورسانت فروش» به نام کارمند */
export async function expenseFromPayout(tx: Tx, payoutId: string): Promise<AccMoneyDoc | null> {
  const existing = await tx.accMoneyDoc.findUnique({ where: { sourceKey: payoutKey(payoutId) } });
  if (existing) return existing;
  const p = await tx.staffPayout.findUnique({ where: { id: payoutId } });
  if (!p) throw new AccError("تسویه‌ی پورسانت پیدا نشد", 404);
  // تسویه‌ی صفر فقط حساب مرجوعی‌ها را می‌بندد؛ پولی جابه‌جا نشده
  if (p.amount <= 0n) return null;

  const t = await settingTreasury(tx, "payoutTreasuryId", `تسویه‌ی پورسانت ${p.userName}`);
  const party = await partyForEmployee(tx, p.userId);
  const acc = await accountByKey(tx, "COMMISSION_EXPENSE");
  return createMoneyDoc(
    tx,
    {
      kind: "EXPENSE",
      date: dayKey(p.paidAt),
      partyId: party.id,
      description: `تسویه‌ی پورسانت ${p.userName}${p.note ? ` — ${p.note}` : ""}`.slice(0, 500),
      lines: [{ accountId: acc.id, amount: p.amount, description: `پورسانت ${faNum(p.dealCount)} معامله` }],
      items: [{ method: METHOD_OF[t.kind], treasuryId: t.id, amount: p.amount }],
      sourceKey: payoutKey(payoutId),
    },
    { id: p.paidById, name: p.paidByName },
  );
}
