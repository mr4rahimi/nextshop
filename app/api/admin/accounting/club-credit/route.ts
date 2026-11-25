import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { formatAmount } from "@/lib/accounting/money";
import { activateClubLiability, clubLiabilityStatus, postClubLiability } from "@/lib/accounting/club-liability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * تعهد اعتبار باشگاه — webhesab-parity.md بخش ۳۴.۲
 * GET  وضعیت: مانده‌ی دفتر امتیاز در برابر حساب، گردش‌های به دفتر نرفته
 * POST {action: "preview"|"activate"}  راه‌اندازی (پیش‌نمایش چیزی نمی‌نویسد) — ACC_SETTINGS
 * POST {action: "post"}  گردش‌های مانده همین حالا به دفتر (worker هر ساعت خودش می‌برد)
 */
export async function GET() {
  const guard = await requirePermission(["ACC_REPORTS", "ACC_SETTINGS"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const status = await clubLiabilityStatus(prisma);
    return NextResponse.json(serialize({ ...status, can: { settings: can(guard.access, "ACC_SETTINGS") } }));
  } catch (e) {
    return accErrorResponse(e, "[acc-club-credit]");
  }
}

export async function POST(req: Request) {
  const guard = await requirePermission("ACC_SETTINGS");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<{ action?: string }>(req);
    const actor = actorOf(guard.access);
    if (b.action === "preview" || b.action === "activate") {
      const r = await prisma.$transaction((tx) => activateClubLiability(tx, actor, { preview: b.action === "preview" }), { timeout: 180_000 });
      if (!r.preview)
        await logActivity({ action: "UPDATE", entity: "SETTINGS", entityTitle: "اعتبار باشگاه", summary: `راه‌اندازی تعهد اعتبار باشگاه — مانده‌ی ${formatAmount(r.total)} تومان` });
      return NextResponse.json(serialize({ ok: true, result: r }));
    }
    if (b.action === "post") {
      const r = await prisma.$transaction((tx) => postClubLiability(tx, actor), { timeout: 180_000 });
      return NextResponse.json(serialize({ ok: true, result: r ?? { rows: 0, voucherId: null } }));
    }
    throw new AccError("درخواست نامعتبر است");
  } catch (e) {
    return accErrorResponse(e, "[acc-club-credit]");
  }
}
