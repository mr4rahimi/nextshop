import { canViewCampaigns, createCampaign, listCampaigns } from "@/lib/marketing/link-service";
import { withLinkGuard, forbidden, readJson, LINK_ANY } from "@/lib/marketing/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** فهرست کمپین‌ها — مدیر و ناظر؛ کارمند فقط «گره‌های من» را دارد */
export async function GET(req: Request) {
  return withLinkGuard(LINK_ANY, async (access) => {
    if (!canViewCampaigns(access)) return forbidden("فهرست کمپین‌ها با مدیر لینک‌سازی است");
    const all = new URL(req.url).searchParams.get("all") === "1";
    return { items: await listCampaigns(all) };
  });
}

/** ساخت کمپین همراه اولین صفحه‌ی هدف */
export async function POST(req: Request) {
  return withLinkGuard(
    "LINK_MANAGE",
    async (access) => ({ campaign: await createCampaign(await readJson(req), access) }),
    201,
  );
}
