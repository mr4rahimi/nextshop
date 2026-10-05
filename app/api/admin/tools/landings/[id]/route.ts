import { NextResponse } from "next/server";
import { logActivityAsync } from "@/lib/activity";
import { deleteLanding, getLanding, saveLandingDraft, updateLandingSettings } from "@/lib/tools/landings";
import { readJson, toolsError, toolsGuard } from "@/lib/tools/route-helpers";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const g = await toolsGuard("view");
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  try {
    return NextResponse.json(await getLanding(id), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return toolsError(e);
  }
}

/**
 * دو نوع ذخیره در یک مسیر:
 * - `blocks`/`theme` → پیش‌نویس (ذخیره‌ی خودکار ویرایشگر؛ لاگ نمی‌شود، هر ۱٫۲ ثانیه می‌آید)
 * - بقیه (عنوان، نامک، سئو) → مستقیم
 */
export async function PATCH(req: Request, ctx: Ctx) {
  const g = await toolsGuard("manage");
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  try {
    const body = await readJson(req);
    const { blocks, theme, ...settings } = body;
    if (blocks !== undefined || theme !== undefined) await saveLandingDraft(id, { blocks, theme });
    if (Object.keys(settings).length > 0) {
      const l = await updateLandingSettings(id, settings);
      logActivityAsync({ action: "UPDATE", entity: "OTHER", entityId: id, entityTitle: l.title, summary: "تنظیمات لندینگ ذخیره شد" });
      return NextResponse.json(l);
    }
    return NextResponse.json(await getLanding(id));
  } catch (e) {
    return toolsError(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const g = await toolsGuard("manage");
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  await deleteLanding(id);
  logActivityAsync({ action: "DELETE", entity: "OTHER", entityId: id, summary: "لندینگ حذف شد" });
  return NextResponse.json({ ok: true });
}
