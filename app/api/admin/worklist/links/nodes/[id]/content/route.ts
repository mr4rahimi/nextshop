import {
  attachContentTask,
  createContentForNode,
  detachContentTask,
} from "@/lib/marketing/link-workflow";
import { withLinkGuard, readJson } from "@/lib/marketing/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * اتصال گره به کار محتوا — `mode`: `create` (کار تازه با پیش‌پر از گره)،
 * `attach` (کار موجود) یا `detach`. ویرایشگر دوم ساخته نمی‌شود (بخش ۷.۶).
 */
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  return withLinkGuard("LINK_MANAGE", async (access) => {
    const body = await readJson(req);
    switch (body.mode) {
      case "create":
        return {
          node: await createContentForNode(
            id,
            {
              title: typeof body.title === "string" ? body.title : undefined,
              writerId: typeof body.writerId === "string" ? body.writerId : undefined,
              publisherId: typeof body.publisherId === "string" ? body.publisherId : null,
              dueAt: typeof body.dueAt === "string" ? body.dueAt : null,
            },
            access,
          ),
        };
      case "attach":
        if (typeof body.taskId !== "string") throw new Error("کار محتوا را انتخاب کنید");
        return { node: await attachContentTask(id, body.taskId, access) };
      case "detach":
        return { node: await detachContentTask(id, access) };
      default:
        throw new Error("حالت نامعتبر است");
    }
  });
}
