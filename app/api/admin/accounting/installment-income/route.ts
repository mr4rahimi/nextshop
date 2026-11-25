import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { formatAmount } from "@/lib/accounting/money";
import { accrualSummary, accrueInstallments, convertLegacyPlans, installmentIncomeStatus } from "@/lib/accounting/installment-income";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * درآمد اقساطی به تناسب زمان — webhesab-parity.md بخش ۳۴.۳
 * GET  وضعیت: مانده‌ی انتظار در برابر حساب، پیش‌بینی ۱۲ ماه، برنامه‌ها
 * POST {action: "post"}  سند ماه‌های تمام‌شده همین حالا (worker خودش می‌زند)
 * POST {action: "preview"|"convert"}  تبدیل برنامه‌های قدیمی (پیش‌نمایش چیزی نمی‌نویسد) — ACC_SETTINGS
 */
export async function GET() {
  const guard = await requirePermission(["ACC_REPORTS", "ACC_SETTINGS"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const status = await installmentIncomeStatus(prisma);
    return NextResponse.json(serialize({ ...status, can: { settings: can(guard.access, "ACC_SETTINGS") } }));
  } catch (e) {
    return accErrorResponse(e, "[acc-installment-income]");
  }
}

export async function POST(req: Request) {
  const guard = await requirePermission("ACC_SETTINGS");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<{ action?: string }>(req);
    const actor = actorOf(guard.access);
    if (b.action === "post") {
      const r = await prisma.$transaction((tx) => accrueInstallments(tx, actor), { timeout: 120_000 });
      return NextResponse.json(serialize({ ok: true, result: { ...r, message: accrualSummary(r) } }));
    }
    if (b.action === "preview" || b.action === "convert") {
      const r = await prisma.$transaction((tx) => convertLegacyPlans(tx, actor, { preview: b.action === "preview" }), { timeout: 120_000 });
      if (b.action === "convert")
        await logActivity({
          action: "UPDATE",
          entity: "SETTINGS",
          entityTitle: "کارمزد اقساط",
          summary: `انتقال کارمزد ماه‌های آینده‌ی ${r.rows.length} برنامه به حساب انتظار — فروش ${formatAmount(r.sales)}، خرید ${formatAmount(r.purchase)}`,
        });
      return NextResponse.json(serialize({ ok: true, result: r }));
    }
    throw new AccError("درخواست نامعتبر است");
  } catch (e) {
    return accErrorResponse(e, "[acc-installment-income]");
  }
}
