import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { can, canAny } from "@/lib/permissions";
import { getAccMode } from "@/lib/accounting/settings";
import { loadStockVelocity } from "@/lib/tools/stock-data";
import { toolsError, toolsGuard } from "@/lib/tools/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?days=30|60|90|180&warehouseId — سرعت فروش کالاها برای «موجودی و نقطه‌ی سفارش» و
 * «سرمایه‌ی درگیر». docs/features/tools.md بخش ۱۴ و ۱۵
 *
 * علاوه بر مجوز ابزارها، دیدن انبار لازم است (ACC_VIEW یا ACC_INVENTORY یا ACC_COST_VIEW)؛
 * بها فقط با ACC_COST_VIEW و سمت سرور حذف می‌شود. بی‌حسابداری داخلی `rows` خالی است و صفحه
 * حالت دستی را نشان می‌دهد.
 */
export async function GET(req: Request) {
  const g = await toolsGuard("view");
  if (!g.ok) return g.res;
  if (!canAny(g.access, ["ACC_VIEW", "ACC_INVENTORY", "ACC_COST_VIEW"])) {
    return NextResponse.json({ error: "برای دیدن موجودی به دسترسی انبار حسابداری نیاز دارید" }, { status: 403 });
  }
  try {
    const url = new URL(req.url);
    const withCost = can(g.access, "ACC_COST_VIEW");
    const canEdit = can(g.access, "ACC_INVENTORY");
    const mode = await getAccMode();
    if (mode !== "INTERNAL") return NextResponse.json({ mode, withCost, canEdit, warehouses: [], rows: [] });

    const days = Number(url.searchParams.get("days")) || 90;
    const warehouseId = url.searchParams.get("warehouseId") || null;
    const [warehouses, rows] = await Promise.all([
      prisma.accWarehouse.findMany({ orderBy: [{ isDefault: "desc" }, { code: "asc" }], select: { id: true, name: true } }),
      loadStockVelocity({ days, warehouseId, withCost }),
    ]);
    return NextResponse.json({ mode, withCost, canEdit, warehouses, rows });
  } catch (e) {
    return toolsError(e);
  }
}
