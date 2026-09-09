import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, can } from "@/lib/permissions";
import { startOfToday, endOfToday } from "@/lib/worklist/types";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * شمارنده‌های بالای کارتابل.
 *
 * سبک نگه داشته می‌شود چون هر بار باز شدن صفحه صدا زده می‌شود: پنج `count`
 * روی ایندکس `(ownerId, status, dueAt)`، بدون هیچ join.
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["WORK_VIEW_OWN", "WORK_VIEW_ALL"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { access } = guard;

  const sp = new URL(req.url).searchParams;
  const canViewAll = can(access, "WORK_VIEW_ALL");
  const scope = sp.get("scope");

  // پیش‌فرض همیشه «کارهای من» است، حتی برای مدیر — کارتابل صفحه‌ی شخصی است
  const base: Prisma.StaffTaskWhereInput =
    canViewAll && scope === "all" ? {} : { ownerId: access.userId };

  const openish: Prisma.StaffTaskWhereInput = {
    ...base,
    status: { in: ["OPEN", "IN_PROGRESS"] },
  };

  const [today, overdue, upcoming, unlogged, doneToday] = await Promise.all([
    prisma.staffTask.count({
      where: {
        ...openish,
        OR: [
          { dueAt: { gte: startOfToday(), lte: endOfToday() } },
          { dueAt: null, createdAt: { gte: startOfToday(), lte: endOfToday() } },
        ],
      },
    }),
    prisma.staffTask.count({ where: { ...openish, dueAt: { lt: new Date() } } }),
    prisma.staffTask.count({ where: { ...openish, dueAt: { gt: endOfToday() } } }),
    prisma.staffTask.count({ where: { ...openish, outcome: null } }),
    prisma.staffTask.count({
      where: { ...base, status: "DONE", doneAt: { gte: startOfToday(), lte: endOfToday() } },
    }),
  ]);

  return NextResponse.json({
    counts: { today, overdue, upcoming, unlogged, doneToday },
    canViewAll,
    scope: canViewAll && scope === "all" ? "all" : "me",
    me: { id: access.userId, name: access.name },
  });
}
