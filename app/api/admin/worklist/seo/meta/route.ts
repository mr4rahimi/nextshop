import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, can } from "@/lib/permissions";
import { usersWithPermission } from "@/lib/marketing/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * خوراک فرم کار سئو: دسته‌ها و کارکنانی که می‌شود کار را به آن‌ها داد.
 *
 * ⚠️ فهرست کارکنان از **مجوز** می‌آید (`SEO_TASK_WORK`)، نه از یک فیلد بخش.
 * یک قانون بهتر از دو قانونی است که با هم اختلاف پیدا می‌کنند — و اینجا
 * دقیقاً همان قانونی است که `createSeoTask` هم با آن اعتبارسنجی می‌کند.
 *
 * ⚠️ تا وقتی مجوز `SEO_TASK_WORK` به نقشی داده نشده، این فهرست فقط
 * ادمین‌های بی‌نقش را دارد. خالی بودنش یعنی مدیر هنوز نقش نساخته، نه اینکه
 * چیزی خراب است — پیامش در کلاینت همین را می‌گوید.
 */
export async function GET() {
  const guard = await requirePermission(["SEO_TASK_WORK", "SEO_TASK_MANAGE", "MARKETING_VIEW_ALL"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const [categories, staff] = await Promise.all([
    prisma.seoTaskCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: { id: true, key: true, title: true, description: true },
    }),
    usersWithPermission("SEO_TASK_WORK"),
  ]);

  return NextResponse.json({
    categories,
    staff: staff.map((s) => ({ ...s, isMe: s.id === guard.access.userId })),
    can: {
      work: can(guard.access, "SEO_TASK_WORK"),
      manage: can(guard.access, "SEO_TASK_MANAGE"),
      viewAll: can(guard.access, "MARKETING_VIEW_ALL"),
    },
    me: { id: guard.access.userId, name: guard.access.name },
  });
}
