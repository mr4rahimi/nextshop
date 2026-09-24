/**
 * دریافت خودکار از پرداخت سایت — رویداد `PAYMENT_RECEIVED` (docs/plans/accounting.md بخش ۹.۱).
 *
 * `Payment` موفق ← دریافت روی صندوق/بانک/درگاهی که `providers` آن شامل
 * `Payment.provider` است، و تخصیص به فاکتور فروش همان سفارش. رویداد روی همان
 * aggregate سفارش است، پس بعد از فاکتور فروش اجرا می‌شود.
 *
 * ⚠️ کیف پول (`WALLET`) و اعتباری (`credit`) اینجا نمی‌آیند — کیف پول بدهی
 *    فروشگاه به مشتری را کم می‌کند و اقساط هر کدام دریافت جدا دارند (فاز ۶).
 */

import type { AccMoneyDoc, AccMoneyMethod, AccTreasuryKind, Prisma } from "@prisma/client";
import { AccError } from "../errors";
import { dayKey } from "../dates";
import { partyForUser } from "../parties";
import { AUTO_ACTOR, orderSaleKey } from "../invoices/channel";
import { invoiceOpenAmounts } from "./allocation";
import { createMoneyDoc } from "./docs";

type Tx = Prisma.TransactionClient;

/** درگاه‌هایی که دریافت خودکار نمی‌سازند */
export const SKIP_PROVIDERS = ["wallet", "credit"];
export const paymentKey = (paymentId: string) => `payment:${paymentId}`;

const METHOD_OF: Record<AccTreasuryKind, AccMoneyMethod> = { CASH: "CASH", BANK: "BANK_TRANSFER", POS: "POS", GATEWAY: "GATEWAY" };

export async function receiptFromPayment(tx: Tx, paymentId: string, at: Date): Promise<AccMoneyDoc | null> {
  const existing = await tx.accMoneyDoc.findUnique({ where: { sourceKey: paymentKey(paymentId) } });
  if (existing) return existing;
  const p = await tx.payment.findUnique({ where: { id: paymentId }, include: { order: { select: { id: true, userId: true, orderNumber: true } } } });
  if (!p) throw new AccError("پرداخت پیدا نشد", 404);
  const provider = (p.provider ?? "").trim();
  if (p.status !== "SUCCEEDED" || p.amount <= 0n || SKIP_PROVIDERS.includes(provider.toLowerCase())) return null;

  const treasuries = await tx.accTreasury.findMany({ where: { isActive: true, providers: { has: provider } }, orderBy: { code: "asc" } });
  const t = treasuries[0];
  if (!t) {
    throw new AccError(
      `پرداخت «${provider || "بی‌نام"}» سفارش ${p.order.orderNumber} به هیچ صندوق یا بانکی وصل نیست — در «صندوق و بانک» روی حساب مقصد، «${provider}» را در درگاه‌های سایت بنویسید`,
    );
  }
  const party = await partyForUser(tx, p.order.userId);
  const sale = await tx.accInvoice.findUnique({ where: { sourceKey: orderSaleKey(p.order.id) }, select: { id: true, status: true } });
  let allocations: { invoiceId: string; amount: bigint }[] = [];
  if (sale?.status === "ISSUED") {
    const open = (await invoiceOpenAmounts(tx, [sale.id])).get(sale.id)?.open ?? 0n;
    const a = open < p.amount ? open : p.amount;
    if (a > 0n) allocations = [{ invoiceId: sale.id, amount: a }];
  }

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
