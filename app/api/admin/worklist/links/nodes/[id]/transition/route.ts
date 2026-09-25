import { canSeeNode } from "@/lib/marketing/link-service";
import { transitionNode } from "@/lib/marketing/link-workflow";
import { NODE_ACTIONS, type NodeAction } from "@/lib/marketing/link-constants";
import { withLinkGuard, forbidden, readJson } from "@/lib/marketing/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * اندپوینتِ **یکتای** گردش کار گره — نه هشت روت جدا. نقش (مسئول یا مدیر) را
 * سرویس چک می‌کند.
 */
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  return withLinkGuard(["LINK_WORK", "LINK_MANAGE"], async (access) => {
    if (!(await canSeeNode(id, access))) return forbidden("این گره به شما ارجاع نشده است");
    const body = await readJson(req);
    const action = body.action as NodeAction;
    if (!NODE_ACTIONS.includes(action)) throw new Error("کنش نامعتبر است");
    const node = await transitionNode(
      id,
      action,
      {
        note: typeof body.note === "string" ? body.note : null,
        publishedUrl: typeof body.publishedUrl === "string" ? body.publishedUrl : null,
        assigneeId: typeof body.assigneeId === "string" ? body.assigneeId : null,
      },
      access,
    );
    return { node };
  });
}
