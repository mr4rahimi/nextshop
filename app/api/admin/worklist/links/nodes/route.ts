import { createNode, listNodes } from "@/lib/marketing/link-service";
import { NODE_STATUSES, type LinkNodeStatus } from "@/lib/marketing/link-constants";
import { withLinkGuard, readJson, LINK_ANY } from "@/lib/marketing/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * فهرست گره‌ها — `?campaignId=` برای جدول کمپین، `?mine=1` برای «گره‌های من».
 *
 * ⚠️ کارمندی که کمپین‌ها را نمی‌بیند همیشه فقط گره‌های خودش را می‌گیرد؛ این
 * مرز در سرویس است، نه در پارامتر (تله‌ی ۱۲).
 */
export async function GET(req: Request) {
  return withLinkGuard(LINK_ANY, async (access) => {
    const sp = new URL(req.url).searchParams;
    const status = (sp.get("status") ?? "")
      .split(",")
      .filter((s): s is LinkNodeStatus => NODE_STATUSES.includes(s as LinkNodeStatus));
    const items = await listNodes(
      {
        campaignId: sp.get("campaignId") || undefined,
        mine: sp.get("mine") === "1",
        status,
        q: sp.get("q") || undefined,
      },
      access,
    );
    return { items };
  });
}

export async function POST(req: Request) {
  return withLinkGuard(
    "LINK_MANAGE",
    async (access) => ({ node: await createNode(await readJson(req), access) }),
    201,
  );
}
