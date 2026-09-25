import {
  canViewCampaigns,
  deleteCampaign,
  getCampaign,
  updateCampaign,
} from "@/lib/marketing/link-service";
import { withLinkGuard, forbidden, readJson, LINK_ANY } from "@/lib/marketing/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  return withLinkGuard(LINK_ANY, async (access) => {
    if (!canViewCampaigns(access)) return forbidden("چارت کمپین با مدیر لینک‌سازی است");
    return { campaign: await getCampaign(id) };
  });
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  return withLinkGuard("LINK_MANAGE", async (access) => ({
    campaign: await updateCampaign(id, await readJson(req), access),
  }));
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  return withLinkGuard("LINK_MANAGE", (access) => deleteCampaign(id, access));
}
