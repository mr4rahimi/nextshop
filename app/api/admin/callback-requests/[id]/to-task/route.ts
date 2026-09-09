import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import { createTask } from "@/lib/worklist/task-service";
import { normalizePhone } from "@/lib/club/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * تبدیل «درخواست تماس» ویجت چت به یک کار در کارتابل.
 *
 * درخواست تماس همان اول زنجیره است: مشتری شماره‌اش را گذاشته و منتظر است.
 * تا وقتی به کار تبدیل نشود، در هیچ گزارش عملکردی دیده نمی‌شود و هیچ مهلتی
 * ندارد.
 *
 * ⚠️ idempotent است: اگر قبلاً تبدیل شده، همان کار برمی‌گردد و کار دوم ساخته
 * نمی‌شود. دو نفر ممکن است هم‌زمان روی یک درخواست کلیک کنند.
 */
export async function POST(_req: Request, { params }: Params) {
  const guard = await requirePermission(["WORK_CREATE", "CALL_LOG"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  const cb = await prisma.callbackRequest.findUnique({ where: { id } });
  if (!cb) return NextResponse.json({ error: "درخواست پیدا نشد" }, { status: 404 });

  if (cb.taskId) {
    const existing = await prisma.staffTask.findUnique({
      where: { id: cb.taskId },
      select: { id: true, title: true },
    });
    if (existing) {
      return NextResponse.json({ task: existing, alreadyLinked: true });
    }
    // کار حذف شده — اجازه بده دوباره ساخته شود
  }

  const type = await prisma.staffTaskType.findUnique({
    where: { slug: "support-call" },
    select: { id: true, isActive: true },
  });
  if (!type?.isActive) {
    return NextResponse.json(
      { error: "نوع کار «پاسخ تماس عمومی» پیدا نشد. اسکریپت سید انواع کار را اجرا کنید." },
      { status: 400 },
    );
  }

  // شماره را با همان تابع پروژه نرمال می‌کنیم تا تاریخچه‌ی مشتری تکه‌تکه نشود
  const phone = normalizePhone(cb.phone) ?? cb.phone;
  const user = cb.userId
    ? await prisma.user.findUnique({
        where: { id: cb.userId },
        select: { id: true, firstName: true, lastName: true },
      })
    : await prisma.user.findUnique({
        where: { phone },
        select: { id: true, firstName: true, lastName: true },
      });

  const task = await createTask(
    {
      typeId: type.id,
      title: "پاسخ به درخواست تماس سایت",
      customerId: user?.id ?? null,
      contactName:
        [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || null,
      contactPhone: phone,
      note: cb.note,
      occurredAt: cb.createdAt,
    },
    guard.access,
  );

  await prisma.callbackRequest.update({
    where: { id },
    data: { taskId: task.id, status: cb.status === "pending" ? "contacted" : cb.status },
  });

  return NextResponse.json(serialize({ task }), { status: 201 });
}
