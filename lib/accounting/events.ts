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
  COMMISSION_PAID: "تسویه‌ی پورسانت",
  WALLET_USED: "پرداخت از کیف پول",
  MARKETPLACE_SETTLED: "تسویه‌ی بازارگاه",
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
