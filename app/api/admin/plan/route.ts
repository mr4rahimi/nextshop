import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, getStaffAccess } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { FEATURES } from "@/lib/plan/features";
import { clearLicenseCache, domainMatches, getLicenseState, parseLicense } from "@/lib/plan/license";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * «بسته‌ی من» — docs/plans/licensing.md
 *
 * GET: وضعیت لایسنس برای هر کارمند پنل. POST: چسباندن لایسنس تازه (تمدید یا
 * ارتقا) با مجوز تنظیمات.
 *
 * ⚠️ راهی برای **پاک کردن** لایسنس نیست؛ فقط جایگزینی با لایسنس معتبرِ همین دامنه.
 *    نبودِ لایسنس یعنی همه‌چیز روشن، پس پاک‌شدنی بودنش یعنی دور زدن بسته.
 */
export async function GET() {
  const access = await getStaffAccess();
  if (!access) return NextResponse.json({ error: "وارد نشده‌اید" }, { status: 401 });

  const s = await getLicenseState();
  const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
  return NextResponse.json({
    status: s.status,
    error: s.error,
    plan: s.payload
      ? {
          name: s.payload.planName,
          business: s.payload.business,
          domain: s.payload.domain,
          issuedAt: s.payload.issuedAt,
          expiresAt: s.payload.expiresAt,
        }
      : null,
    daysLeft: s.daysLeft,
    graceLeft: s.graceLeft,
    seats: s.seats,
    activeAdmins,
    features: FEATURES.map((f) => ({
      ...f,
      included: s.panelFeatures === "*" || s.panelFeatures.includes(f.key),
    })),
  });
}

export async function POST(req: Request) {
  const guard = await requirePermission("PANEL_SETTINGS");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) return NextResponse.json({ error: "متن لایسنس را بچسبانید" }, { status: 400 });

  const parsed = parseLicense(token);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (!domainMatches(parsed.payload)) {
    return NextResponse.json({ error: `این لایسنس برای ${parsed.payload.domain} صادر شده، نه این سایت` }, { status: 400 });
  }

  // لایسنس قدیمی‌تر جای تازه‌تر را نمی‌گیرد — جلوی برگرداندن بسته‌ی بزرگ‌ترِ منقضی را می‌گیرد
  const current = await getLicenseState();
  if (current.payload && Date.parse(parsed.payload.issuedAt) < Date.parse(current.payload.issuedAt)) {
    return NextResponse.json({ error: "این لایسنس از لایسنس فعلی قدیمی‌تر است" }, { status: 400 });
  }

  await prisma.storeSettings.upsert({
    where: { id: "singleton" },
    update: { licenseToken: token },
    create: { id: "singleton", licenseToken: token },
  });
  clearLicenseCache();

  await logActivity({
    action: "UPDATE",
    entity: "SETTINGS",
    entityTitle: "بسته‌ی گردانوس",
    summary: `لایسنس گردانوس ثبت شد: بسته‌ی ${parsed.payload.planName}`,
  });

  return NextResponse.json({ ok: true });
}
