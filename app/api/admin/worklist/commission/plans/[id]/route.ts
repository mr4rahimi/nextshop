import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logActivityAsync } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * ویرایش طرح یا افزودن قاعده.
 *
 * `{ title?, isActive?, addRule?: { categoryId, condition, referral, percent } }`
 * تغییر طرح فقط معامله‌هایی را که **بعد از این** قطعی شوند عوض می‌کند؛ درصدِ
 * معامله‌های قبلی روی خودشان اسنپ‌شات است (بخش ۲۲.۸).
 */
export async function PATCH(req: Request, { params }: Params) {
  const guard = await requirePermission("COMMISSION_MANAGE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "بدنه‌ی نامعتبر" }, { status: 400 });

  const plan = await prisma.staffCommissionPlan.findUnique({ where: { id }, select: { title: true } });
  if (!plan) return NextResponse.json({ error: "طرح پیدا نشد" }, { status: 404 });

  const data: { title?: string; isActive?: boolean } = {};
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim().slice(0, 80);
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (Object.keys(data).length) await prisma.staffCommissionPlan.update({ where: { id }, data });

  if (body.addRule) {
    const r = body.addRule;
    const percent = Number(r.percent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      return NextResponse.json({ error: "درصد باید بین ۰ و ۱۰۰ باشد" }, { status: 400 });
    }
    const condition = ["NEW", "STOCK", "USED", "REFURBISHED"].includes(r.condition) ? r.condition : null;
    const categoryId = typeof r.categoryId === "string" && r.categoryId ? r.categoryId : null;
    const referral = r.referral === true;
    const duplicate = await prisma.staffCommissionRule.findFirst({
      where: { planId: id, categoryId, condition, referral, isActive: true },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json({ error: "قاعده‌ای با همین دسته، وضعیت و ریفری از قبل هست؛ همان را ویرایش کنید" }, { status: 409 });
    }
    await prisma.staffCommissionRule.create({ data: { planId: id, categoryId, condition, referral, percent } });
  }

  logActivityAsync({
    action: "UPDATE",
    entity: "SETTINGS",
    entityId: id,
    entityTitle: data.title ?? plan.title,
    summary: `ویرایش طرح پورسانت «${data.title ?? plan.title}»${body.addRule ? " — قاعده‌ی تازه" : ""}`,
  });
  return NextResponse.json({ ok: true });
}
