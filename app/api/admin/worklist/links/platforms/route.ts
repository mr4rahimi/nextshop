import { createPlatform } from "@/lib/marketing/link-service";
import { withLinkGuard, readJson } from "@/lib/marketing/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return withLinkGuard(
    "MARKETING_SETTINGS_MANAGE",
    async () => ({ platform: await createPlatform(await readJson(req)) }),
    201,
  );
}
