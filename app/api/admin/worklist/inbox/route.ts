import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { markReferralsSeen } from "@/lib/worklist/task-service";
import { startOfToday, endOfToday } from "@/lib/worklist/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** حداکثر ارجاع فوری که در یک poll برمی‌گردد — پاپ‌آپ‌ها پشت سر هم نشان داده می‌شوند */
const MAX_POPUPS = 5;

/** اعلان‌های سئو/محتوا/لینک پاپ‌آپ نمی‌گیرند؛ فهرست کوتاه زیر نشان می‌نشینند */
const MAX_NOTIFICATIONS = 8;

/**
 * صندوق ورودی — خوراک پاپ‌آپ ارجاع فوری و نشان روی منو.
 *
 * فروشگاه websocket ندارد و برایش هم نمی‌سازیم؛ یک poll هر سی ثانیه کافی است.
 * پس این مسیر باید **سبک** بماند: سه شمارش روی ایندکس و حداکثر پنج ردیف،
 * بدون هیچ join سنگین.
 */
export async function GET() {
  // ⚠️ نگهبان عمداً گشاد است: کارمند سئو ممکن است هیچ مجوز کارتابلی نداشته
  // باشد ولی اعلان کار سئو بگیرد. صندوق ورودی خودش چیزی جز شمارنده و پنج
  // ردیفِ خودِ کاربر برنمی‌گرداند، پس گشاد بودنش نشتی نمی‌سازد.
  const guard = await requirePermission([
    "WORK_VIEW_OWN",
    "WORK_VIEW_ALL",
    "SEO_TASK_WORK",
    "SEO_TASK_MANAGE",
    "CONTENT_TASK_WORK",
    "CONTENT_TASK_MANAGE",
    "LINK_WORK",
    "LINK_MANAGE",
  ]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const me = guard.access.userId;

  const [urgent, unseenCount, overdue, todayOpen, marketing] = await Promise.all([
    prisma.staffTaskReferral.findMany({
      where: { toId: me, seenAt: null, isUrgent: true },
      orderBy: { createdAt: "desc" },
      take: MAX_POPUPS,
      select: {
        id: true,
        taskId: true,
        fromName: true,
        note: true,
        createdAt: true,
        task: { select: { id: true, title: true, contactName: true, contactPhone: true } },
      },
    }),
    prisma.staffTaskReferral.count({ where: { toId: me, seenAt: null } }),
    prisma.staffTask.count({
      where: { ownerId: me, status: { in: ["OPEN", "IN_PROGRESS"] }, dueAt: { lt: new Date() } },
    }),
    prisma.staffTask.count({
      where: {
        ownerId: me,
        status: { in: ["OPEN", "IN_PROGRESS"] },
        OR: [
          { dueAt: { gte: startOfToday(), lte: endOfToday() } },
          { dueAt: null, createdAt: { gte: startOfToday(), lte: endOfToday() } },
        ],
      },
    }),
    // اعلان‌های سئو، محتوا و لینک‌سازی — سبک، فقط ردیف‌های خوانده‌نشده
    prisma.staffNotification.findMany({
      where: { userId: me, readAt: null },
      orderBy: { createdAt: "desc" },
      take: MAX_NOTIFICATIONS,
      select: {
        id: true,
        type: true,
        entityId: true,
        title: true,
        body: true,
        url: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    urgent,
    marketing,
    counts: {
      unseenReferrals: unseenCount,
      overdue,
      todayOpen,
      marketing: marketing.length,
    },
  });
}

/**
 * علامت‌زدن «دیدم».
 *
 * فقط با شناسه‌ی صریح کار می‌کند؛ درخواست بدون `referralIds` هیچ ردیفی را
 * دست نمی‌زند، تا هیچ‌وقت کل صندوق کسی یک‌جا پاک نشود.
 */
export async function POST(req: Request) {
  const guard = await requirePermission([
    "WORK_VIEW_OWN",
    "WORK_VIEW_ALL",
    "SEO_TASK_WORK",
    "SEO_TASK_MANAGE",
    "CONTENT_TASK_WORK",
    "CONTENT_TASK_MANAGE",
    "LINK_WORK",
    "LINK_MANAGE",
  ]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { referralIds, notificationIds } = await req.json();
    const refs = Array.isArray(referralIds)
      ? referralIds.filter((x) => typeof x === "string")
      : [];
    const notes = Array.isArray(notificationIds)
      ? notificationIds.filter((x) => typeof x === "string")
      : [];

    if (refs.length === 0 && notes.length === 0) {
      return NextResponse.json({ error: "شناسه‌ی ارجاع یا اعلان لازم است" }, { status: 400 });
    }

    let count = 0;
    if (refs.length) {
      const result = await markReferralsSeen(guard.access.userId, { referralIds: refs });
      count += result.count;
    }
    if (notes.length) {
      // ⚠️ `userId` در شرط می‌ماند: بدون آن، شناسه‌ی اعلان دیگری هم خوانده می‌شد
      const result = await prisma.staffNotification.updateMany({
        where: { id: { in: notes }, userId: guard.access.userId, readAt: null },
        data: { readAt: new Date() },
      });
      count += result.count;
    }

    return NextResponse.json({ ok: true, count });
  } catch {
    return NextResponse.json({ error: "خطای سرور" }, { status: 400 });
  }
}
