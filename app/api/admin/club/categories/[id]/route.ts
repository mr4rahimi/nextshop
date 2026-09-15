import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logActivityAsync } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * ویرایش دسته. DELETE ندارد — مشتری‌ها به دسته ارجاع دارند و گزارش‌های قدیمی
 * با حذفش جابه‌جا می‌شوند؛ غیرفعال‌کردن فقط از فهرست انتخاب بیرونش می‌برد.
 */
export async function PATCH(req: Request, { params }: Params) {
  const guard = await requirePermission("CUSTOMER_CATEGORY_MANAGE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "بدنه‌ی نامعتبر" }, { status: 400 });

  const data: { title?: string; color?: string | null; sortOrder?: number; isActive?: boolean } = {};
  if (typeof body.title === "string") {
    const t = body.title.trim().slice(0, 60);
    if (!t) return NextResponse.json({ error: "عنوان دسته لازم است" }, { status: 400 });
    data.title = t;
  }
  if (body.color !== undefined) data.color = typeof body.color === "string" ? body.color.slice(0, 20) : null;
  if (Number.isInteger(body.sortOrder)) data.sortOrder = body.sortOrder;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  try {
    const category = await prisma.clubCustomerCategory.update({ where: { id }, data });
    logActivityAsync({
      action: "UPDATE",
      entity: "SETTINGS",
      entityId: category.id,
      entityTitle: category.title,
      summary: `ویرایش دسته‌ی مشتری «${category.title}»${category.isActive ? "" : " (غیرفعال)"}`,
    });
    return NextResponse.json({ category });
  } catch {
    return NextResponse.json({ error: "دسته پیدا نشد" }, { status: 404 });
  }
}
