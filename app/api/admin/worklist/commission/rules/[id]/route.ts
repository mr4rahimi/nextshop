import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logActivityAsync } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** تغییر درصد یک قاعده */
export async function PATCH(req: Request, { params }: Params) {
  const guard = await requirePermission("COMMISSION_MANAGE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const percent = Number(body?.percent);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return NextResponse.json({ error: "درصد باید بین ۰ و ۱۰۰ باشد" }, { status: 400 });
  }
  try {
    const rule = await prisma.staffCommissionRule.update({ where: { id }, data: { percent } });
    logActivityAsync({ action: "UPDATE", entity: "SETTINGS", entityId: rule.planId, summary: `تغییر درصد قاعده‌ی پورسانت به ${percent}٪` });
    return NextResponse.json({ rule });
  } catch {
    return NextResponse.json({ error: "قاعده پیدا نشد" }, { status: 404 });
  }
}

/**
 * حذف قاعده. قاعده‌ی پیش‌فرض (بدون دسته و وضعیت) حذف نمی‌شود — طرح بدون آن
 * کالایی دارد که بی‌صدا صفر حساب می‌شود. حذف امن است چون درصد روی ردیف‌های
 * قطعی‌شده اسنپ‌شات شده.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const guard = await requirePermission("COMMISSION_MANAGE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const rule = await prisma.staffCommissionRule.findUnique({ where: { id }, select: { categoryId: true, condition: true, referral: true, planId: true } });
  if (!rule) return NextResponse.json({ error: "قاعده پیدا نشد" }, { status: 404 });
  if (!rule.categoryId && !rule.condition && !rule.referral) {
    return NextResponse.json({ error: "قاعده‌ی پیش‌فرض طرح حذف نمی‌شود؛ درصدش را عوض کنید" }, { status: 400 });
  }
  await prisma.staffCommissionRule.delete({ where: { id } });
  logActivityAsync({ action: "DELETE", entity: "SETTINGS", entityId: rule.planId, summary: "حذف قاعده‌ی پورسانت" });
  return NextResponse.json({ ok: true });
}
