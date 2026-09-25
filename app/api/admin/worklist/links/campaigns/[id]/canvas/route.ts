import { canViewCampaigns, getCanvas } from "@/lib/marketing/link-service";
import { withLinkGuard, forbidden, LINK_ANY } from "@/lib/marketing/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** داده‌ی بوم — همان داده‌ی جدول با نمای دیگر؛ هیچ منطق تازه‌ای ندارد */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  return withLinkGuard(LINK_ANY, async (access) => {
    if (!canViewCampaigns(access)) return forbidden("چارت کمپین با مدیر لینک‌سازی است");
    return getCanvas(id);
  });
}
