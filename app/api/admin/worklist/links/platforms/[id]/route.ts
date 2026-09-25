import { removePlatform, updatePlatform } from "@/lib/marketing/link-service";
import { withLinkGuard, readJson } from "@/lib/marketing/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  return withLinkGuard("MARKETING_SETTINGS_MANAGE", async () => ({
    platform: await updatePlatform(id, await readJson(req)),
  }));
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  return withLinkGuard("MARKETING_SETTINGS_MANAGE", async () => ({
    result: await removePlatform(id),
  }));
}
