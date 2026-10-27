import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { canAny, requirePermission } from "@/lib/permissions";
import { accErrorResponse } from "@/lib/accounting/errors";
import { getAccMode } from "@/lib/accounting/settings";
import { kioskWarehouse, priceCheck } from "@/lib/accounting/pos/price-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** نمای کارمند (موجودی عددی، قیمت آنلاین، انبارهای دیگر) — کاربر فقط-کیوسک نمای مشتری دارد */
const STAFF = ["ACC_VIEW", "ACC_INVENTORY", "ACC_SALES", "ACC_POS", "ACC_POS_MANAGE"];

/**
 * GET ?w=انبار&q=کد — چک کردن قیمت (docs/plans/webhesab-parity.md بخش ۹).
 * بی `q`: راه‌اندازی صفحه (انبار کیوسک، فهرست انبارها، نما).
 */
export async function GET(req: Request) {
  const g = await requirePermission(["ACC_PRICE_CHECK", ...STAFF]);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  if ((await getAccMode()) !== "INTERNAL") {
    return NextResponse.json({ error: "چک کردن قیمت حسابداری داخلی می‌خواهد — اول «راه‌اندازی حسابداری» را انجام دهید" }, { status: 409 });
  }
  try {
    const url = new URL(req.url);
    const staff = canAny(g.access, STAFF);
    const warehouse = await kioskWarehouse(url.searchParams.get("w"));
    const q = url.searchParams.get("q")?.trim();
    if (!q) {
      const warehouses = await prisma.accWarehouse.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: [{ isDefault: "desc" }, { code: "asc" }] });
      return NextResponse.json({ warehouse, warehouses, staff });
    }
    return NextResponse.json(serialize({ warehouse, staff, result: await priceCheck(q, warehouse.id, { staff }) }));
  } catch (e) {
    return accErrorResponse(e, "[acc-price-check]");
  }
}
