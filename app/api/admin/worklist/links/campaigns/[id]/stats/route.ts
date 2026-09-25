import { campaignStats, canViewCampaigns } from "@/lib/marketing/link-service";
import { withLinkGuard, forbidden, LINK_ANY } from "@/lib/marketing/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** اعداد کنار چارت: پیشرفت، توزیع لایه و نوع و انکر و فالو، هزینه */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  return withLinkGuard(LINK_ANY, async (access) => {
    if (!canViewCampaigns(access)) return forbidden();
    return campaignStats(id);
  });
}
