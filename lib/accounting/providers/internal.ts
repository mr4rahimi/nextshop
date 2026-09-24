/**
 * حسابداری داخلی — مصرف‌کننده‌ی رویدادها.
 *
 * هر نوع رویداد در فاز خودش وصل می‌شود (docs/plans/accounting.md بخش ۵ و ۲۰).
 * تا آن وقت رویداد «مسدود» می‌ماند، نه «ثبت‌شده»: اگر حالت داخلی زودتر از
 * مصرف‌کننده روشن شود، رویداد گم نمی‌شود و بعد از وصل شدن خودش پردازش می‌شود.
 *
 * خطای `AccError` (سال مالی نیست، تاریخ قفل است، نگاشت ندارد …) یعنی داده
 * ناقص است ← «مسدود» با همان پیام. هر خطای دیگری «تلاش دوباره» است.
 */

import type { AccEvent, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AccountingProvider, ApplyResult } from "../port";
import { AccError } from "../errors";
import { purchaseFromTask, reverseOrderSale, saleFromIntegOrder, saleFromOrder, voidIntegSale } from "../invoices/channel";
import { receiptFromPayment } from "../cash/channel";

type Handler = (event: AccEvent) => Promise<ApplyResult>;
type Payload = { orderId?: string; integOrderId?: string; taskId?: string; paymentId?: string; reason?: string };

/** یک تراکنش برای هر رویداد — فاکتور، کاردکس و سند با هم ثبت یا با هم لغو */
function invoiceHandler(fn: (tx: Prisma.TransactionClient, p: Payload, e: AccEvent) => Promise<{ id: string } | null>, empty: string): Handler {
  return async (event) => {
    const p = (event.payload ?? {}) as Payload;
    try {
      const inv = await prisma.$transaction((tx) => fn(tx, p, event), { timeout: 60_000 });
      return inv ? { kind: "done", ref: inv.id } : { kind: "skipped", reason: empty };
    } catch (e) {
      if (e instanceof AccError) return { kind: "blocked", reason: e.message };
      throw e;
    }
  };
}

const HANDLERS: Partial<Record<string, Handler>> = {
  SALE_ISSUED: invoiceHandler(
    (tx, p, e) => (p.integOrderId ? saleFromIntegOrder(tx, p.integOrderId) : saleFromOrder(tx, p.orderId!, e.createdAt)),
    "چیزی برای فاکتور نماند (سفارش بی‌قلم یا لغوشده)",
  ),
  SALE_VOIDED: invoiceHandler(
    (tx, p, e) =>
      p.integOrderId ? voidIntegSale(tx, p.integOrderId) : reverseOrderSale(tx, p.orderId!, "void", e.createdAt, p.reason ?? "لغو سفارش"),
    "فاکتوری برای ابطال نبود (فروش پیش از حسابداری داخلی ثبت شده)",
  ),
  SALE_RETURNED: invoiceHandler(
    (tx, p, e) => reverseOrderSale(tx, p.orderId!, "return", e.createdAt, p.reason ?? "مرجوعی سفارش"),
    "فاکتوری برای برگشت نبود (فروش پیش از حسابداری داخلی ثبت شده)",
  ),
  PURCHASE_RECORDED: invoiceHandler((tx, p) => purchaseFromTask(tx, p.taskId!), "کالای قیمت‌دار یا سفارش مرتبطی نبود"),
  PAYMENT_RECEIVED: invoiceHandler((tx, p, e) => receiptFromPayment(tx, p.paymentId!, e.createdAt), "پرداخت کیف پول، اعتباری یا بی‌مبلغ دریافت جدا نمی‌سازد"),
};

export const internalProvider: AccountingProvider = {
  async apply(event) {
    const handler = HANDLERS[event.type];
    if (!handler) {
      return { kind: "blocked", reason: "حسابداری داخلی هنوز این نوع رویداد را ثبت نمی‌کند" };
    }
    return handler(event);
  },
};
