import { NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/permissions";
import { getLicenseState } from "@/lib/plan/license";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * دسترسی کاربر جاری — سایدبار با همین منوی بخش‌های بسته را پنهان می‌کند.
 *
 * ⚠️ پنهان‌کردن منو امنیت نیست؛ مرز واقعی `proxy.ts` و `requirePermission`
 * است. این فقط تا کارمند روی لینکی نزند که به «دسترسی ندارید» می‌رسد.
 */
export async function GET() {
  const access = await getStaffAccess();
  if (!access) return NextResponse.json({ error: "وارد نشده‌اید" }, { status: 401 });
  return NextResponse.json({
    userId: access.userId,
    name: access.name,
    roleTitle: access.roleTitle,
    isUnrestricted: access.isUnrestricted,
    permissions: access.isUnrestricted ? [] : access.permissions,
    plan: await planSummary(),
  });
}

/** خلاصه‌ی بسته برای سایدبار (قفل منو) و نوار هشدار انقضا — lib/plan/license.ts */
async function planSummary() {
  const s = await getLicenseState();
  return {
    status: s.status,
    name: s.payload?.planName ?? null,
    features: s.panelFeatures,
    daysLeft: s.daysLeft,
    graceLeft: s.graceLeft,
  };
}
