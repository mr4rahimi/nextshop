import { deleteTarget, updateTarget } from "@/lib/marketing/link-service";
import { withLinkGuard, readJson } from "@/lib/marketing/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  return withLinkGuard("LINK_MANAGE", async (access) => ({
    target: await updateTarget(id, await readJson(req), access),
  }));
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  return withLinkGuard("LINK_MANAGE", (access) => deleteTarget(id, access));
}
