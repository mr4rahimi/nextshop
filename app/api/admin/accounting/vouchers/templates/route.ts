import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { createTemplate, TEMPLATE_INCLUDE, templateUsage, type TemplateBody } from "@/lib/accounting/ledger/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — فهرست ورودی‌های سریع با آمار استفاده */
export async function GET() {
  const guard = await requirePermission("ACC_VOUCHER");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const [items, usage] = await Promise.all([
    prisma.accVoucherTemplate.findMany({ orderBy: { name: "asc" }, include: TEMPLATE_INCLUDE }),
    templateUsage(prisma),
  ]);
  return NextResponse.json(serialize({ items: items.map((t) => ({ ...t, used: usage.get(t.id)?.count ?? 0, lastUsed: usage.get(t.id)?.last ?? null })) }));
}

/** POST — الگوی تازه */
export async function POST(req: Request) {
  const guard = await requirePermission("ACC_VOUCHER");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<TemplateBody>(req);
    const t = await prisma.$transaction((tx) => createTemplate(tx, b, actorOf(guard.access)));
    await logActivity({ action: "CREATE", entity: "OTHER", entityId: t.id, entityTitle: `ورودی سریع ${t.name}`, summary: `ورودی سریع «${t.name}» ساخته شد` });
    return NextResponse.json(serialize({ ok: true, template: t }));
  } catch (e) {
    return accErrorResponse(e, "[acc-templates]");
  }
}
