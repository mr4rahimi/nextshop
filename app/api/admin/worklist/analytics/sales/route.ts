import { withLinkGuard } from "@/lib/marketing/route-helpers";
import { getSalesReport } from "@/lib/analytics/site-analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** تب «منبع فروش» — از `Order` (docs/plans/seo-marketing.md بخش ۱۳.۵ و ۱۳.۶) */
export async function GET(req: Request) {
  const range = new URL(req.url).searchParams.get("range");
  return withLinkGuard(["SEO_ANALYTICS_VIEW", "MARKETING_SETTINGS_MANAGE"], () => getSalesReport(range));
}
