import { NextResponse } from "next/server";
import { logActivityAsync } from "@/lib/activity";
import { deletePopup, popupLeads, updatePopup } from "@/lib/tools/popups";
import { readJson, toolsError, toolsGuard } from "@/lib/tools/route-helpers";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** شماره‌های ثبت‌شده‌ی یک پاپ‌آپ — docs/features/tools.md بخش ۹ */
export async function GET(_req: Request, ctx: Ctx) {
  const g = await toolsGuard("view");
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  return NextResponse.json({ leads: await popupLeads(id) }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * ذخیره‌ی کامل. ⚠️ ایراد قابل‌نمایش با ۲۰۰ و `ok:false` — CDN بدنه‌ی ۴xx را عوض می‌کند
 * و متن «کد تخفیف وجود ندارد» باید به کاربر برسد (همان قاعده‌ی انتشار لندینگ).
 */
export async function PUT(req: Request, ctx: Ctx) {
  const g = await toolsGuard("manage");
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  try {
    const p = await updatePopup(id, await readJson(req));
    logActivityAsync({ action: "UPDATE", entity: "OTHER", entityId: id, entityTitle: p.name, summary: `پاپ‌آپ «${p.name}» ذخیره شد (${p.isActive ? "روشن" : "خاموش"})` });
    return NextResponse.json({ ok: true, popup: p });
  } catch (e) {
    const res = toolsError(e);
    if (res.status === 400) return NextResponse.json({ ok: false, error: (await res.json()).error });
    return res;
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const g = await toolsGuard("manage");
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  try {
    await deletePopup(id);
    logActivityAsync({ action: "DELETE", entity: "OTHER", entityId: id, entityTitle: "پاپ‌آپ", summary: "پاپ‌آپ حذف شد" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toolsError(e);
  }
}
