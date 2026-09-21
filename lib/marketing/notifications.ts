/**
 * اعلان درون‌پنلی سئو، محتوا و لینک‌سازی.
 *
 * جدول `StaffNotification` عمداً **عمومی** است و به یک حوزه قفل نیست
 * (برخلاف `StaffTaskReferral` که به `StaffTask` می‌چسبد). خوراکش را
 * `/api/admin/worklist/inbox` می‌دهد و `WorklistNotifier` نشانش می‌دهد.
 *
 * سه قاعده:
 *
 * **۱. کسی به خودش اعلان نمی‌دهد.** مدیری که خودش کار را هم انجام می‌دهد
 * نباید برای کار خودش پیام بگیرد.
 *
 * **۲. اعلان هیچ‌وقت عملیات اصلی را نمی‌شکند.** مثل `logActivity`، خطا فقط
 * در کنسول می‌نشیند. انتقال وضعیتی که به‌خاطر یک insert اعلان rollback شود،
 * بدتر از اعلان نرسیده است.
 *
 * **۳. پیامک عمداً نیست.** هزینه دارد و تیم سئو همیشه پای پنل است.
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۸
 */

import { prisma } from "@/lib/prisma";
import type { StaffNotificationType } from "@prisma/client";

interface NotifyInput {
  /** گیرنده‌ها — تکراری و خالی و خودِ فرستنده حذف می‌شوند */
  userIds: (string | null | undefined)[];
  /** فرستنده؛ از فهرست گیرنده‌ها بیرون می‌رود */
  actorId?: string | null;
  type: StaffNotificationType;
  entityId: string;
  title: string;
  body?: string | null;
  url: string;
}

export async function notify(input: NotifyInput): Promise<number> {
  const targets = [...new Set(input.userIds.filter((id): id is string => !!id))].filter(
    (id) => id !== input.actorId,
  );
  if (targets.length === 0) return 0;

  try {
    const res = await prisma.staffNotification.createMany({
      data: targets.map((userId) => ({
        userId,
        type: input.type,
        entityId: input.entityId,
        title: input.title,
        body: input.body ?? null,
        url: input.url,
      })),
    });
    return res.count;
  } catch (e) {
    console.error("[marketing] ثبت اعلان شکست خورد:", e);
    return 0;
  }
}

/**
 * شناسه‌ی کارکنانی که یک مجوز مشخص را دارند.
 *
 * ⚠️ ادمینِ **بدون نقش** همه‌ی مجوزها را دارد (`isUnrestricted` در
 * `lib/permissions.ts`) و باید در این فهرست بیاید، وگرنه در فروشگاهی که
 * هنوز نقشی تعریف نکرده، اعلانِ «منتظر تأیید» به هیچ‌کس نمی‌رسد.
 */
export async function usersWithPermission(permission: string): Promise<
  { id: string; name: string }[]
> {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ["ADMIN", "SELLER"] },
      OR: [
        // ادمینِ بی‌نقش = دسترسی کامل
        { role: "ADMIN", staffRoleId: null },
        { staffRole: { isActive: true, permissions: { has: permission } } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, phone: true },
  });

  return users.map((u) => ({
    id: u.id,
    name: [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.phone || "بدون نام",
  }));
}
