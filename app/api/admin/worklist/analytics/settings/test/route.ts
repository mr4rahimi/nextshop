import { withLinkGuard, readJson } from "@/lib/marketing/route-helpers";
import { testUmami } from "@/lib/analytics/umami";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * «آزمایش اتصال» — روی مقدار فرم، نه مقدار ذخیره‌شده، تا پیش از ذخیره
 * معلوم شود کد درست است و به همان سایت اشاره دارد.
 */
export async function POST(req: Request) {
  return withLinkGuard("MARKETING_SETTINGS_MANAGE", async () => {
    const body = await readJson(req);
    const slug = String(body.umamiShareSlug ?? "").trim();
    const websiteId = String(body.umamiWebsiteId ?? "").trim() || null;
    if (!slug) throw new Error("کد اشتراک خالی است");
    return testUmami(slug, websiteId);
  });
}
