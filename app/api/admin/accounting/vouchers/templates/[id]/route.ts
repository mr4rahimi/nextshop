import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";
import { TEMPLATE_INCLUDE, updateTemplate, type TemplateBody } from "@/lib/accounting/ledger/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const guard = await requirePermission("ACC_VOUCHER");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await params;
  const template = await prisma.accVoucherTemplate.findUnique({ where: { id }, include: TEMPLATE_INCLUDE });
  if (!template) return NextResponse.json({ error: "الگو پیدا نشد" }, { status: 404 });
  return NextResponse.json(serialize({ template }));
}

export async function PUT(req: Request, { params }: Ctx) {
  const guard = await requirePermission("ACC_VOUCHER");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const b = await readJson<TemplateBody>(req);
    const t = await prisma.$transaction((tx) => updateTemplate(tx, id, b));
    await logActivity({ action: "UPDATE", entity: "OTHER", entityId: t.id, entityTitle: `ورودی سریع ${t.name}`, summary: `ورودی سریع «${t.name}» ویرایش شد` });
    return NextResponse.json(serialize({ ok: true, template: t }));
  } catch (e) {
    return accErrorResponse(e, "[acc-templates]");
  }
}

/** حذف الگو — سندهای ثبت‌شده از روی آن می‌مانند */
export async function DELETE(_req: Request, { params }: Ctx) {
  const guard = await requirePermission("ACC_VOUCHER");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const t = await prisma.accVoucherTemplate.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!t) throw new AccError("الگو پیدا نشد", 404);
    await prisma.accVoucherTemplate.delete({ where: { id } });
    await logActivity({ action: "DELETE", entity: "OTHER", entityId: t.id, entityTitle: `ورودی سریع ${t.name}`, summary: `ورودی سریع «${t.name}» حذف شد` });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return accErrorResponse(e, "[acc-templates]");
  }
}
