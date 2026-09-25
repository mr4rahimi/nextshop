import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, can } from "@/lib/permissions";
import { usersWithPermission } from "@/lib/marketing/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * خوراک فرم کار محتوا: کارکنان و دسته‌های مجله.
 *
 * ⚠️ فهرست کارکنان از **مجوز** `CONTENT_TASK_WORK` می‌آید (بخش ۴، قاعده‌ی ۲)
 * — همان قانونی که سرویس هنگام ساخت با آن اعتبارسنجی نمی‌کند ولی فرم با آن
 * پیشنهاد می‌دهد.
 *
 * ⚠️ دسته‌های مجله اینجا می‌آیند نه از `/api/admin/blog/categories`، چون آن
 * مسیر `PANEL_CONTENT` می‌خواهد و محتواگذار ندارد.
 */
export async function GET() {
  const guard = await requirePermission([
    "CONTENT_TASK_WORK",
    "CONTENT_TASK_MANAGE",
    "MARKETING_VIEW_ALL",
  ]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const [staff, categories] = await Promise.all([
    usersWithPermission("CONTENT_TASK_WORK"),
    prisma.blogCategory.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  return NextResponse.json({
    staff: staff.map((s) => ({ ...s, isMe: s.id === guard.access.userId })),
    categories,
    can: {
      work: can(guard.access, "CONTENT_TASK_WORK"),
      manage: can(guard.access, "CONTENT_TASK_MANAGE"),
      viewAll: can(guard.access, "MARKETING_VIEW_ALL"),
    },
    me: { id: guard.access.userId, name: guard.access.name },
  });
}
