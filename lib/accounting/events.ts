/**
 * صف رویداد مالی — الگوی outbox (docs/plans/accounting.md بخش ۴.۲).
 *
 * هر بخش فروشگاه که تغییر مالی می‌سازد فقط `emitAccEvent` را صدا می‌زند؛
 * `dispatcher.ts` رویداد را به حسابداری داخلی می‌رساند.
 *
 * ⚠️ `dedupeKey` یکتاست و ثبت دوباره بی‌اثر است — گذار تکراری سفارش یا
 *    webhook تکراری رویداد دوم نمی‌سازد.
 * ⚠️ اگر تغییر کسب‌وکار داخل تراکنش است، `tx` همان تراکنش را پاس بده تا
 *    رویداد و تغییر با هم ثبت یا با هم لغو شوند.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** انواع رویداد — بخش ۴.۳ سند. هر نوع با مصرف‌کننده‌اش در فاز خودش وصل می‌شود. */
export const ACC_EVENT_TYPES = {
  SALE_ISSUED: "فاکتور فروش",
  SALE_VOIDED: "ابطال فروش",
  SALE_RETURNED: "برگشت از فروش",
  PAYMENT_RECEIVED: "دریافت وجه",
  PAYMENT_REFUNDED: "استرداد وجه",
  PURCHASE_RECORDED: "فاکتور خرید",
  PURCHASE_RETURNED: "برگشت از خرید",
  INSTALLMENT_PAID: "واریز قسط",
  COMMISSION_PAID: "تسویه‌ی پورسانت",
  WALLET_ADJUSTED: "شارژ یا کسر کیف پول",
  STOCK_TRANSFERRED: "حواله‌ی انبار",
  STOCK_ADJUSTED: "انبارگردانی",
} as const;

export type AccEventType = keyof typeof ACC_EVENT_TYPES;

export interface AccEventInput {
  type: AccEventType;
  aggregate: { type: string; id: string };
  /** کلید یکتای معنایی — مثلاً `order:<id>:sale` */
  dedupeKey: string;
  /** فقط شناسه‌ها و اسنپ‌شات لازم، نه کل رکورد */
  payload?: Prisma.InputJsonValue;
}

type Db = PrismaClient | Prisma.TransactionClient;

/** ثبت رویداد. تکراری بودن خطا نیست؛ `true` یعنی رویداد تازه ساخته شد. */
export async function emitAccEvent(input: AccEventInput, db: Db = prisma): Promise<boolean> {
  const res = await db.accEvent.createMany({
    data: [
      {
        type: input.type,
        aggregateType: input.aggregate.type,
        aggregateId: input.aggregate.id,
        dedupeKey: input.dedupeKey,
        payload: input.payload ?? {},
      },
    ],
    skipDuplicates: true,
  });
  return res.count > 0;
}

let kickTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * «یک تلاش فوری بعد از commit» (بخش ۴.۲) — صف همین حالا یک بار می‌چرخد تا
 * فاکتور منتظر چرخه‌ی ۳۰ ثانیه‌ای worker نماند. چند صدا زدن پشت سر هم یکی
 * می‌شود. خطا مسیر فراخواننده را نمی‌شکند؛ worker بعداً همان را برمی‌دارد.
 */
export function kickAccDispatch(): void {
  if (kickTimer) return;
  kickTimer = setTimeout(() => {
    kickTimer = null;
    import("./dispatcher")
      .then((m) => m.dispatchAccEvents())
      .catch((e: unknown) => console.error("[acc-dispatch] اجرای فوری ناموفق:", e));
  }, 300);
}

/** ثبت رویداد بیرون از تراکنش + اجرای فوری صف. خطا فقط لاگ می‌شود. */
export async function emitAccEventSafe(input: AccEventInput): Promise<void> {
  try {
    if (await emitAccEvent(input)) kickAccDispatch();
  } catch (e) {
    console.error("[acc-event] ثبت رویداد ناموفق:", input.dedupeKey, e);
  }
}

/**
 * دریافت خودکار پرداخت‌های موفق یک سفارش (فاز ۵، کیف پول از فاز ۶) — **بعد از**
 * کسر موجودی صدا زده شود تا رویداد روی همان aggregate سفارش پشت فاکتور فروش
 * بیاید. اعتباری رد می‌شود؛ هر قسطش `INSTALLMENT_PAID` جدا دارد. تکرار بی‌اثر است.
 */
export async function emitPaymentsReceived(orderId: string): Promise<void> {
  try {
    const payments = await prisma.payment.findMany({
      where: { orderId, status: "SUCCEEDED", amount: { gt: 0 } },
      select: { id: true, provider: true },
    });
    for (const p of payments) {
      if ((p.provider ?? "").toLowerCase() === "credit") continue;
      await emitAccEventSafe({
        type: "PAYMENT_RECEIVED",
        aggregate: { type: "Order", id: orderId },
        dedupeKey: `payment:${p.id}:received`,
        payload: { paymentId: p.id, orderId },
      });
    }
  } catch (e) {
    console.error("[acc-event] ثبت رویداد پرداخت ناموفق:", orderId, e);
  }
}
