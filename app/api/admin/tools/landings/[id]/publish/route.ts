import { NextResponse } from "next/server";
import { logActivityAsync } from "@/lib/activity";
import { publishLanding, unpublishLanding } from "@/lib/tools/landings";
import { toolsError, toolsGuard } from "@/lib/tools/route-helpers";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** انتشار — پیش‌نویس روی نسخه‌ی عمومی کپی می‌شود. خطاها با شماره‌ی بلوک (۴۲۲). */
export async function POST(_req: Request, ctx: Ctx) {
  const g = await toolsGuard("manage");
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  try {
    const r = await publishLanding(id);
    if (!r.ok) return NextResponse.json({ error: "پیش از انتشار این‌ها را درست کنید", errors: r.errors }, { status: 422 });
    logActivityAsync({ action: "UPDATE", entity: "OTHER", entityId: id, entityTitle: r.landing.title, summary: `لندینگ /l/${r.landing.slug} منتشر شد` });
    return NextResponse.json(r.landing);
  } catch (e) {
    return toolsError(e);
  }
}

/** لغو انتشار — پیش‌نویس می‌ماند، صفحه‌ی عمومی ۴۰۴ می‌شود */
export async function DELETE(_req: Request, ctx: Ctx) {
  const g = await toolsGuard("manage");
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  try {
    const l = await unpublishLanding(id);
    logActivityAsync({ action: "UPDATE", entity: "OTHER", entityId: id, entityTitle: l.title, summary: `انتشار لندینگ /l/${l.slug} لغو شد` });
    return NextResponse.json(l);
  } catch (e) {
    return toolsError(e);
  }
}
