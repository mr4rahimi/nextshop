import { can } from "@/lib/permissions";
import { withLinkGuard } from "@/lib/marketing/route-helpers";
import { getTrafficReport } from "@/lib/analytics/site-analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * تب «بازدید» — از Umami (docs/plans/seo-marketing.md بخش ۱۳.۶).
 * `withLinkGuard` نگهبان مشترک بخش‌های مارکتینگ است، نه مخصوص لینک‌سازی.
 */
export async function GET(req: Request) {
  const range = new URL(req.url).searchParams.get("range");
  return withLinkGuard(["SEO_ANALYTICS_VIEW", "MARKETING_SETTINGS_MANAGE"], async (access) => ({
    ...(await getTrafficReport(range)),
    canManage: can(access, "MARKETING_SETTINGS_MANAGE"),
  }));
}
