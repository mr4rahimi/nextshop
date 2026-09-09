import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { markReferralsSeen } from "@/lib/worklist/task-service";
import { startOfToday, endOfToday } from "@/lib/worklist/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** حداکثر ارجاع فوری که در یک poll برمی‌گردد — پاپ‌آپ‌ها پشت سر هم نشان داده می‌شوند */
const MAX_POPUPS = 5;

/**
 * صندوق ورودی — خوراک پاپ‌آپ ارجاع فوری و نشان روی منو.
 *
 * فروشگاه websocket ندارد و برایش هم نمی‌سازیم؛ یک poll هر سی ثانیه کافی است.
 * پس این مسیر باید **سبک** بماند: سه شمارش روی ایندکس و حداکثر پنج ردیف،
 * بدون هیچ join سنگین.
 */
export async function GET() {
  const guard = await requirePermission(["WORK_VIEW_OWN", "WORK_VIEW_ALL"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const me = guard.access.userId;

  const [urgent, unseenCount, overdue, todayOpen] = await Promise.all([
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
  ]);

  return NextResponse.json({
    urgent,
    counts: { unseenReferrals: unseenCount, overdue, todayOpen },
  });
}

/**
 * علامت‌زدن «دیدم».
 *
 * فقط با شناسه‌ی صریح کار می‌کند؛ درخواست بدون `referralIds` هیچ ردیفی را
 * دست نمی‌زند، تا هیچ‌وقت کل صندوق کسی یک‌جا پاک نشود.
 */
export async function POST(req: Request) {
  const guard = await requirePermission(["WORK_VIEW_OWN", "WORK_VIEW_ALL"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { referralIds } = await req.json();
    if (!Array.isArray(referralIds) || referralIds.length === 0) {
      return NextResponse.json({ error: "شناسه‌ی ارجاع لازم است" }, { status: 400 });
    }
    const result = await markReferralsSeen(guard.access.userId, {
      referralIds: referralIds.filter((x) => typeof x === "string"),
    });
    return NextResponse.json({ ok: true, count: result.count });
  } catch {
    return NextResponse.json({ error: "خطای سرور" }, { status: 400 });
  }
}
