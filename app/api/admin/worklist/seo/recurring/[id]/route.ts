import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import {
  RECURRING_SELECT,
  validateRecurring,
  type RecurringInput,
} from "@/lib/marketing/seo-sweep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * ویرایش الگو.
 *
 * ⚠️ تغییر الگو **کارهای ساخته‌شده‌اش را جابه‌جا نمی‌کند** — عوض‌کردن مسئول
 * یعنی از نوبت بعد، نه اینکه کارِ باز دست کسی عوض شود.
 *
 * ⚠️ `nextRunAt` فقط وقتی دست می‌خورد که کاربر صریحاً تاریخ تازه‌ای بدهد؛
 * ویرایش عنوان نباید نوبت بعدی را جابه‌جا کند.
 */
export async function PATCH(req: Request, { params }: Params) {
  const guard = await requirePermission("SEO_TASK_MANAGE");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  try {
    const existing = await prisma.seoRecurringTask.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "الگو پیدا نشد" }, { status: 404 });

    const body = (await req.json()) as RecurringInput & { nextRunAt?: string | null };

    // تغییر فقط وضعیت فعال/غیرفعال — بدون اعتبارسنجی کامل فرم
    if (
      typeof body.isActive === "boolean" &&
      body.title === undefined &&
      body.categoryId === undefined
    ) {
      const rule = await prisma.seoRecurringTask.update({
        where: { id },
        data: { isActive: body.isActive },
        select: RECURRING_SELECT,
      });
      return NextResponse.json(serialize({ rule }));
    }

    const base = validateRecurring(body);
    const data: Record<string, unknown> = { ...base };

    if (body.categoryId) {
      const category = await prisma.seoTaskCategory.findFirst({
        where: { id: body.categoryId, isActive: true },
        select: { id: true },
      });
      if (!category) throw new Error("دسته‌ی انتخاب‌شده معتبر نیست");
      data.categoryId = category.id;
    }

    if (body.assigneeId) {
      const user = await prisma.user.findFirst({
        where: { id: body.assigneeId, isActive: true, role: { in: ["ADMIN", "SELLER"] } },
        select: { firstName: true, lastName: true, phone: true },
      });
      if (!user) throw new Error("کارمند انتخاب‌شده پیدا نشد");
      data.assigneeId = body.assigneeId;
      data.assigneeName =
        [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
        user.phone ||
        "بدون نام";
    }

    if (body.nextRunAt) {
      const d = new Date(body.nextRunAt);
      if (!Number.isNaN(d.getTime())) data.nextRunAt = d;
    }

    if (typeof body.isActive === "boolean") data.isActive = body.isActive;

    const rule = await prisma.seoRecurringTask.update({
      where: { id },
      data,
      select: RECURRING_SELECT,
    });

    return NextResponse.json(serialize({ rule }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * حذف **نرم**.
 *
 * کارهایی که این الگو ساخته سرجایشان می‌مانند — تاریخچه‌ی «چه کاری از کجا
 * آمد» نباید با پاک‌کردن یک الگو از بین برود.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const guard = await requirePermission("SEO_TASK_MANAGE");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  const res = await prisma.seoRecurringTask.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  });
  if (res.count === 0) {
    return NextResponse.json({ error: "الگو پیدا نشد" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
