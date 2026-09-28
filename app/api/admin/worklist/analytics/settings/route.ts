import { prisma } from "@/lib/prisma";
import { withLinkGuard, readJson } from "@/lib/marketing/route-helpers";
import { forgetAnalyticsSettings, UUID_RE, umamiBaseUrl } from "@/lib/analytics/umami";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * تنظیمات آمار بازدید — فقط `MARKETING_SETTINGS_MANAGE`.
 * کد اشتراک فقط همین‌جا به مرورگر می‌رسد (docs/plans/seo-marketing.md بخش ۱۳.۲).
 */
export async function GET() {
  return withLinkGuard("MARKETING_SETTINGS_MANAGE", async () => {
    const row = await prisma.seoAnalyticsSettings.findUnique({ where: { id: "singleton" } });
    return {
      trackingEnabled: row?.trackingEnabled ?? false,
      umamiWebsiteId: row?.umamiWebsiteId ?? "",
      umamiShareSlug: row?.umamiShareSlug ?? "",
      updatedAt: row?.updatedAt ?? null,
      updatedByName: row?.updatedByName ?? null,
      // فقط برای نمایش؛ از `.env` سرور می‌آید و از پنل عوض نمی‌شود
      umamiBaseUrl: umamiBaseUrl(),
    };
  });
}

const SLUG_RE = /^[A-Za-z0-9_-]{4,100}$/;

export async function PUT(req: Request) {
  return withLinkGuard("MARKETING_SETTINGS_MANAGE", async (access) => {
    const body = await readJson(req);
    const websiteId = String(body.umamiWebsiteId ?? "").trim();
    const shareSlug = String(body.umamiShareSlug ?? "").trim();
    const trackingEnabled = body.trackingEnabled === true;

    if (websiteId && !UUID_RE.test(websiteId)) {
      throw new Error("شناسه‌ی سایت Umami باید به شکل uuid باشد (مثل 3f2c…-…)");
    }
    if (shareSlug && !SLUG_RE.test(shareSlug)) {
      throw new Error("کد اشتراک فقط حرف لاتین، عدد، خط تیره و زیرخط دارد");
    }
    // ردیاب بی‌شناسه هیچ چیزی نمی‌فرستد و فقط این توهم را می‌سازد که روشن است
    if (trackingEnabled && !websiteId) {
      throw new Error("برای روشن کردن ردیاب، شناسه‌ی سایت Umami لازم است");
    }

    const data = {
      trackingEnabled,
      umamiWebsiteId: websiteId || null,
      umamiShareSlug: shareSlug || null,
      updatedByName: access.name,
    };
    await prisma.seoAnalyticsSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    });
    forgetAnalyticsSettings();
    return { ok: true };
  });
}
