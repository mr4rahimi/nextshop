import { addTarget } from "@/lib/marketing/link-service";
import { withLinkGuard, readJson } from "@/lib/marketing/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** صفحه‌ی هدف تازه برای کمپین */
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  return withLinkGuard(
    "LINK_MANAGE",
    async (access) => ({ target: await addTarget(id, await readJson(req), access) }),
    201,
  );
}
