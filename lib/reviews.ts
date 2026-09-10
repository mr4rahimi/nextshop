/**
 * نظرات محصول — منطق مشترک بین API عمومی، پنل ادمین و صفحه‌ی محصول.
 *
 * سه قاعده‌ای که همه‌جا باید یکسان بماند و برای همین اینجا جمع شده‌اند:
 *
 * ۱. هیچ نظری بدون تأیید ادمین دیده نمی‌شود — نه در صفحه، نه در اسکیما،
 *    نه در میانگین امتیاز.
 * ۲. برچسب «خریدار» در لحظه‌ی ثبت محاسبه و ذخیره می‌شود، نه هنگام نمایش؛
 *    اگر بعداً سفارش حذف یا مرجوع شود، برچسبِ آن روز درست بوده است.
 * ۳. `ratingAvg` و `ratingCount` روی خود محصول مادی‌سازی شده‌اند تا لیست
 *    محصولات لازم نباشد نظرها را بخواند. هر تغییر وضعیت نظر باید
 *    `recomputeProductRating` را صدا بزند وگرنه عدد صفحه با واقعیت نمی‌خواند.
 *
 * مستندات: docs/features/reviews.md
 */

import { prisma } from "@/lib/prisma";
import { publicAuthorName } from "@/lib/moderation";
import type { OrderStatus } from "@prisma/client";

export { clean, cleanList, cleanMultiline } from "@/lib/moderation";

/** بیشترین طول‌های مجاز — هم برای امنیت، هم برای اینکه اسکیما خوانا بماند */
export const REVIEW_LIMITS = {
  name: 60,
  email: 120,
  title: 120,
  body: 2000,
  pro: 80,
  con: 80,
  prosCount: 5,
  consCount: 5,
  replyBody: 1000,
} as const;

/**
 * سفارش‌هایی که «خرید انجام‌شده» حساب می‌شوند.
 *
 * `PENDING_PAYMENT` عمداً نیست: سبد رهاشده خرید نیست. `CANCELED` و
 * `REFUNDED` هم نیستند چون معامله برگشته است.
 */
export const BUYER_ORDER_STATUSES: OrderStatus[] = [
  "PAID",
  "CONFIRMED",
  "PROCESSING",
  "PACKAGING",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
];

/** آیا این کاربر همین محصول را در سفارشی پرداخت‌شده یا تحویل‌شده خریده است؟ */
export async function hasPurchased(
  userId: string,
  productId: string,
): Promise<boolean> {
  const found = await prisma.orderItem.findFirst({
    where: {
      productId,
      order: { userId, status: { in: BUYER_ORDER_STATUSES } },
    },
    select: { id: true },
  });
  return Boolean(found);
}

/**
 * میانگین و تعداد امتیاز محصول را از روی نظرهای **تأییدشده** بازمی‌سازد.
 *
 * تنها نقطه‌ای که مجاز است `ratingAvg` و `ratingCount` را بنویسد.
 */
export async function recomputeProductRating(productId: string) {
  const agg = await prisma.review.aggregate({
    where: { productId, status: "APPROVED" },
    _avg: { rating: true },
    _count: { _all: true },
  });

  const count = agg._count._all;
  const avg = count > 0 ? Number((agg._avg.rating ?? 0).toFixed(1)) : 0;

  await prisma.product.update({
    where: { id: productId },
    data: { ratingAvg: avg, ratingCount: count },
  });

  return { ratingAvg: avg, ratingCount: count };
}

/** نام نویسنده‌ی نظر، همان قاعده‌ای که نظر مقاله هم از آن پیروی می‌کند */
export const reviewAuthorName = publicAuthorName;
