import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { isInvolved } from "@/lib/worklist/task-service";
import { purchaseItemsOf, PURCHASE_TASK_SLUG } from "@/lib/worklist/deals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * کالاهای سفارشِ یک کار «تأمین کالا» — برای فرم «خرید شد» در کارت کار.
 *
 * ⚠️ قیمت خرید برمی‌گردد، پس همان مرز دیدنِ خودِ کار را دارد: درگیر بودن در
 * کار یا `WORK_VIEW_ALL`. کسی که این کار را می‌بیند، همان کسی است که قیمت را
 * وارد می‌کند.
 */
export async function GET(_req: Request, { params }: Params) {
  const guard = await requirePermission(["WORK_VIEW_OWN", "WORK_VIEW_ALL"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const task = await prisma.staffTask.findUnique({
    where: { id },
    select: { entity: true, entityId: true, type: { select: { slug: true } } },
  });
  if (!task) return NextResponse.json({ error: "کار پیدا نشد" }, { status: 404 });
  if (!can(guard.access, "WORK_VIEW_ALL") && !(await isInvolved(id, guard.access.userId))) {
    return NextResponse.json({ error: "به این کار دسترسی ندارید" }, { status: 403 });
  }
  if (task.type.slug !== PURCHASE_TASK_SLUG || task.entity !== "ORDER" || !task.entityId) {
    return NextResponse.json({ items: [] });
  }
  return NextResponse.json(serialize({ items: await purchaseItemsOf(task.entityId) }));
}
