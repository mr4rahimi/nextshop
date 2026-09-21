import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import {
  RECURRING_SELECT,
  validateRecurring,
  type RecurringInput,
} from "@/lib/marketing/seo-sweep";
import { nextRunAfter } from "@/lib/marketing/seo-recurrence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * الگوهای کار دوره‌ای سئو.
 *
 * ⚠️ ساخت و ویرایش **فقط مدیر سئو**. کارمند الگوها را می‌بیند — تا بداند چه
 * چیزی قرار است برایش ساخته شود — ولی عوضشان نمی‌کند.
 *
 * مستندات: docs/plans/seo-marketing.md بخش ۵.۶
 */
export async function GET() {
  const guard = await requirePermission(["SEO_TASK_WORK", "SEO_TASK_MANAGE", "MARKETING_VIEW_ALL"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const items = await prisma.seoRecurringTask.findMany({
    where: { deletedAt: null },
    orderBy: [{ isActive: "desc" }, { nextRunAt: "asc" }],
    select: RECURRING_SELECT,
  });

  return NextResponse.json(serialize({ items }));
}

export async function POST(req: Request) {
  const guard = await requirePermission("SEO_TASK_MANAGE");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const body = (await req.json()) as RecurringInput;
    const base = validateRecurring(body);

    const category = await prisma.seoTaskCategory.findFirst({
      where: { id: String(body.categoryId ?? ""), isActive: true },
      select: { id: true },
    });
    if (!category) throw new Error("دسته‌ی انتخاب‌شده معتبر نیست");

    // ⚠️ الگوی بی‌مسئول هیچ‌وقت کار نمی‌سازد و بی‌صدا رد می‌شود؛ پس همین‌جا
    // جلویش گرفته می‌شود، نه در جاروب.
    if (!body.assigneeId) {
      throw new Error("مسئول الگو لازم است — کارِ بی‌صاحب ساخته نمی‌شود");
    }
    const user = await prisma.user.findFirst({
      where: { id: body.assigneeId, isActive: true, role: { in: ["ADMIN", "SELLER"] } },
      select: { firstName: true, lastName: true, phone: true },
    });
    if (!user) throw new Error("کارمند انتخاب‌شده پیدا نشد");
    const assigneeName =
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
      user.phone ||
      "بدون نام";

    // اولین اجرا: اگر داده نشده، یک دوره بعد از حالا
    const now = new Date();
    const firstRun = body.firstRunAt ? new Date(body.firstRunAt) : null;
    const nextRunAt =
      firstRun && !Number.isNaN(firstRun.getTime())
        ? firstRun
        : nextRunAfter(now, base.unit, base.intervalCount);

    const rule = await prisma.seoRecurringTask.create({
      data: {
        ...base,
        categoryId: category.id,
        assigneeId: body.assigneeId,
        assigneeName,
        nextRunAt,
      },
      select: RECURRING_SELECT,
    });

    return NextResponse.json(serialize({ rule }), { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
