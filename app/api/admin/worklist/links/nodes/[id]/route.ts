import {
  canSeeNode,
  deleteNode,
  getNode,
  getNodeEvents,
  updateNode,
} from "@/lib/marketing/link-service";
import { withLinkGuard, forbidden, readJson, LINK_ANY } from "@/lib/marketing/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** گره با تاریخچه */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  return withLinkGuard(LINK_ANY, async (access) => {
    if (!(await canSeeNode(id, access))) return forbidden("این گره به شما ارجاع نشده است");
    const [node, events] = await Promise.all([getNode(id), getNodeEvents(id)]);
    return { node, events };
  });
}

/** ویرایش بریف و مقصد — مدیر. وضعیت از مسیر `transition` عوض می‌شود. */
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  return withLinkGuard("LINK_MANAGE", async (access) => ({
    node: await updateNode(id, await readJson(req), access),
  }));
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  return withLinkGuard("LINK_MANAGE", (access) => deleteNode(id, access));
}
