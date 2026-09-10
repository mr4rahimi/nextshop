/**
 * نظرات مقاله — منطق مشترک بین API عمومی، پنل ادمین و صفحه‌ی مقاله.
 *
 * همان سه قاعده‌ی نظرات محصول اینجا هم برقرار است: بدون تأیید ادمین چیزی
 * دیده نمی‌شود، ورودی همیشه پاک‌سازی و کوتاه می‌شود، و شمارنده‌ای که به
 * کاربر نشان داده می‌شود فقط نظرهای تأییدشده را می‌شمارد.
 *
 * مستندات: docs/features/reviews.md
 */

import { prisma } from "@/lib/prisma";

export const BLOG_COMMENT_LIMITS = {
  name: 60,
  email: 120,
  content: 2000,
} as const;

/** بیش از این تعداد نظر از یک IP در یک ساعت، ثبت نمی‌شود */
export const MAX_PER_IP_PER_HOUR = 5;

/**
 * تعداد نظرهای **تأییدشده**ی یک مقاله، شامل پاسخ‌ها.
 *
 * `_count.comments` پریزما همه‌ی نظرها را می‌شمارد — از جمله در انتظار تأیید
 * و ردشده — و عددی که تا امروز بالای بخش نظرات مقاله دیده می‌شد با فهرست
 * زیرش نمی‌خواند.
 */
export async function approvedCommentCount(postId: string): Promise<number> {
  return prisma.blogComment.count({
    where: { postId, status: "APPROVED" },
  });
}

/**
 * درخت نظرهای تأییدشده‌ی یک مقاله — نظرهای ریشه با پاسخ‌هایشان.
 *
 * پاسخ‌ها برعکس نظرهای ریشه از قدیم به جدید مرتب می‌شوند؛ گفتگو باید به
 * ترتیبی خوانده شود که اتفاق افتاده است.
 */
export function approvedCommentsQuery(postId?: string) {
  return {
    where: {
      status: "APPROVED" as const,
      parentId: null,
      ...(postId ? { postId } : {}),
    },
    orderBy: [
      { helpfulYes: "desc" as const },
      { createdAt: "desc" as const },
    ],
    include: {
      user: {
        select: { firstName: true, lastName: true, avatarUrl: true },
      },
      replies: {
        where: { status: "APPROVED" as const },
        orderBy: { createdAt: "asc" as const },
        include: {
          user: {
            select: { firstName: true, lastName: true, avatarUrl: true },
          },
        },
      },
    },
  };
}
