import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";
import { posGuard } from "@/lib/accounting/pos/api";
import { posItems } from "@/lib/accounting/pos/setup";
import { commitRelabel } from "@/lib/accounting/inventory/relabel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST — ترکیب رنگ/سایزی که هنوز کالا نشده، از پنجره‌ی انتخاب صندوق: کالای تازه با کد
 * الگو در همان مدل (مثل «برچسب‌گذاری دوباره» بی شمار برچسب). مدیر صندوق یا انبار.
 */
export async function POST(req: Request) {
  const g = await posGuard(["ACC_POS_MANAGE", "ACC_INVENTORY"]);
  if (!g.ok) return g.res;
  try {
    const b = await readJson<{ terminalId?: string; modelId?: string; legacyCode?: string | null; values?: Record<string, string> }>(req);
    const terminal = await prisma.accPosTerminal.findUnique({ where: { id: b.terminalId ?? "" }, select: { warehouseId: true } });
    if (!terminal) throw new AccError("صندوق پیدا نشد", 404);
    if (!b.modelId) throw new AccError("مدل را انتخاب کنید");
    const out = await prisma.$transaction((tx) => commitRelabel(tx, { modelId: b.modelId!, legacyCode: b.legacyCode ?? null, rows: [{ values: b.values ?? {}, qty: 0 }], byName: g.access.name }));
    const item = (await posItems([out[0].itemId], terminal.warehouseId)).get(out[0].itemId);
    return NextResponse.json(serialize({ ok: true, item }));
  } catch (e) {
    return accErrorResponse(e, "[acc-pos-variant]");
  }
}
