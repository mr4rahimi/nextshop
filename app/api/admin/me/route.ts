import { NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/permissions";

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
  });
}
