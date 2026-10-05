import { NextResponse } from "next/server";
import { logActivityAsync } from "@/lib/activity";
import { deleteShortLink, serializeLink, shortLinkStats, updateShortLink } from "@/lib/tools/short-links";
import { readJson, toolsError, toolsGuard } from "@/lib/tools/route-helpers";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** آمار یک لینک — `?days=7|30|90` */
export async function GET(req: Request, ctx: Ctx) {
  const g = await toolsGuard("view");
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  const d = Number(new URL(req.url).searchParams.get("days"));
  const days = [7, 30, 90].includes(d) ? d : 30;
  try {
    return NextResponse.json(await shortLinkStats(id, days), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return toolsError(e);
  }
}

/** کد عوض نمی‌شود؛ مقصد، عنوان، UTM، روشن/خاموش و انقضا */
export async function PATCH(req: Request, ctx: Ctx) {
  const g = await toolsGuard("manage");
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  try {
    const link = await updateShortLink(id, await readJson(req));
    logActivityAsync({ action: "UPDATE", entity: "OTHER", entityId: id, entityTitle: link.title, summary: `لینک کوتاه /s/${link.code} ویرایش شد` });
    return NextResponse.json(serializeLink(link));
  } catch (e) {
    return toolsError(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const g = await toolsGuard("manage");
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  await deleteShortLink(id);
  logActivityAsync({ action: "DELETE", entity: "OTHER", entityId: id, summary: "لینک کوتاه حذف شد" });
  return NextResponse.json({ ok: true });
}
