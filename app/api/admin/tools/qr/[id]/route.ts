import { NextResponse } from "next/server";
import { logActivityAsync } from "@/lib/activity";
import { deleteQrCode, updateQrCode } from "@/lib/tools/qr-codes";
import { readJson, toolsError, toolsGuard } from "@/lib/tools/route-helpers";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** عنوان، محتوا و ظاهر — نوع و ثابت/پویا عوض نمی‌شود */
export async function PATCH(req: Request, ctx: Ctx) {
  const g = await toolsGuard("manage");
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  try {
    const qr = await updateQrCode(id, await readJson(req));
    logActivityAsync({ action: "UPDATE", entity: "OTHER", entityId: id, entityTitle: qr.title, summary: "کیوآر کد ویرایش شد" });
    return NextResponse.json(qr);
  } catch (e) {
    return toolsError(e);
  }
}

/** حذف QR پویا لینک کوتاهش را هم خاموش می‌کند */
export async function DELETE(_req: Request, ctx: Ctx) {
  const g = await toolsGuard("manage");
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  await deleteQrCode(id);
  logActivityAsync({ action: "DELETE", entity: "OTHER", entityId: id, summary: "کیوآر کد حذف شد" });
  return NextResponse.json({ ok: true });
}
