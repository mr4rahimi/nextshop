import { buildPlan } from "@/lib/marketing/link-workflow";
import { withLinkGuard } from "@/lib/marketing/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** «ساخت برنامه» — اجرای دوباره امن است؛ فقط گره‌های برنامه‌ریزی‌شده را دست می‌زند */
export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  return withLinkGuard("LINK_MANAGE", (access) => buildPlan(id, access));
}
