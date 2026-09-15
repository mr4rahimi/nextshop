import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, can } from "@/lib/permissions";
import { logActivityAsync } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** طرح‌ها با قاعده‌ها و کارکنانشان، به‌علاوه‌ی فهرست دسته‌های کالا برای فرم قاعده */
export async function GET() {
  const guard = await requirePermission(["COMMISSION_MANAGE", "COMMISSION_VIEW_ALL"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const [plans, categories, staff] = await Promise.all([
    prisma.staffCommissionPlan.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        rules: {
          orderBy: [{ categoryId: { sort: "asc", nulls: "first" } }, { condition: { sort: "asc", nulls: "first" } }],
          include: { category: { select: { title: true } } },
        },
        _count: { select: { users: true } },
      },
    }),
    prisma.category.findMany({ orderBy: [{ parentId: "asc" }, { title: "asc" }], select: { id: true, title: true, parentId: true } }),
    prisma.user.findMany({
      where: { isActive: true, role: { in: ["ADMIN", "SELLER"] } },
      orderBy: [{ firstName: "asc" }, { phone: "asc" }],
      select: { id: true, firstName: true, lastName: true, phone: true, commissionPlanId: true },
    }),
  ]);

  return NextResponse.json({
    plans,
    categories,
    staff: staff.map((u) => ({
      id: u.id,
      name: [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.phone,
      planId: u.commissionPlanId,
    })),
    can: { manage: can(guard.access, "COMMISSION_MANAGE") },
  });
}

/**
 * طرح تازه — همیشه با قاعده‌ی پیش‌فرض (بدون دسته، بدون وضعیت).
 * طرحِ بی‌پیش‌فرض کالایی دارد که بی‌صدا صفر حساب می‌شود (تله‌ی ۳۹).
 */
export async function POST(req: Request) {
  const guard = await requirePermission("COMMISSION_MANAGE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 80) : "";
  const percent = Number(body?.defaultPercent ?? 10);
  if (!title) return NextResponse.json({ error: "عنوان طرح لازم است" }, { status: 400 });
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return NextResponse.json({ error: "درصد باید بین ۰ و ۱۰۰ باشد" }, { status: 400 });
  }

  const plan = await prisma.staffCommissionPlan.create({
    data: { title, rules: { create: [{ percent }] } },
  });
  logActivityAsync({
    action: "CREATE",
    entity: "SETTINGS",
    entityId: plan.id,
    entityTitle: plan.title,
    summary: `ساخت طرح پورسانت «${plan.title}» با پیش‌فرض ${percent}٪`,
  });
  return NextResponse.json({ plan }, { status: 201 });
}
