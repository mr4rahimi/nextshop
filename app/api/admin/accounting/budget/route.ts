import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission, type StaffAccess } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { budgetEditor, saveBudget, type BudgetSaveBody } from "@/lib/accounting/budget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** عملکرد سال قبل بهای تمام‌شده را هم نشان می‌دهد؛ پس تنظیم بودجه هر دو مجوز را می‌خواهد */
const costDenied = (access: StaffAccess) =>
  can(access, "ACC_COST_VIEW") ? null : NextResponse.json({ error: "بودجه بهای تمام‌شده دارد؛ مجوز «دیدن بهای تمام‌شده» لازم است" }, { status: 403 });

/** GET ?yearId — داده‌ی صفحه‌ی تنظیم بودجه (webhesab-parity.md بخش ۲۲) */
export async function GET(req: Request) {
  const guard = await requirePermission("ACC_SETTINGS");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const denied = costDenied(guard.access);
  if (denied) return denied;
  try {
    const yearId = new URL(req.url).searchParams.get("yearId");
    return NextResponse.json(serialize(await budgetEditor(prisma, yearId)));
  } catch (e) {
    return accErrorResponse(e, "[acc-budget]");
  }
}

/** PUT { yearId, rows: [{ accountId, months: [مبلغ هر ماه] }] } — فقط ردیف‌های فرستاده‌شده عوض می‌شوند */
export async function PUT(req: Request) {
  const guard = await requirePermission("ACC_SETTINGS");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const denied = costDenied(guard.access);
  if (denied) return denied;
  try {
    const body = await readJson<BudgetSaveBody>(req);
    const saved = await prisma.$transaction((tx) => saveBudget(tx, body, actorOf(guard.access)));
    await logActivity({ action: "UPDATE", entity: "OTHER", entityId: saved.year.id, entityTitle: `بودجه ${saved.year.title}`, summary: `بودجه‌ی ${saved.accounts} حساب در ${saved.year.title} ذخیره شد` });
    return NextResponse.json(serialize({ ok: true, accounts: saved.accounts }));
  } catch (e) {
    return accErrorResponse(e, "[acc-budget]");
  }
}
