import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { currentYear } from "@/lib/accounting/ledger/fiscal-year";
import { ensureDefaultWarehouse, OPENING_INV_SOURCE, saveOpeningInventory } from "@/lib/accounting/inventory/docs";
import { AccError, accErrorResponse, toAmount } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?suggest=1 — موجودی کالای اول دوره. `suggest` کالاهایی که در سایت
 * موجودی دارند ولی هنوز در فهرست نیستند را با بهای پیشنهادی برمی‌گرداند
 * (قیمت خرید نگاشت حسابداری، وگرنه آخرین قیمت خرید سفارش‌ها).
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_INVENTORY", "ACC_COST_VIEW"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const year = await currentYear();
    if (!year) throw new AccError("سال مالی تعریف نشده است", 404);
    const wh = await prisma.$transaction((tx) => ensureDefaultWarehouse(tx));
    const moves = await prisma.accStockMove.findMany({ where: { sourceType: OPENING_INV_SOURCE, sourceId: year.id } });
    const listed = new Set(moves.map((m) => m.productId));

    let suggestions: { productId: string; qty: number; unitCost: bigint }[] = [];
    if (new URL(req.url).searchParams.get("suggest") === "1") {
      const inStock = await prisma.product.findMany({ where: { stock: { gt: 0 }, id: { notIn: [...listed] } }, select: { id: true, stock: true }, take: 2000 });
      const links = await prisma.integMappingLink.findMany({
        where: { platformCode: "shop", externalId: { in: inStock.map((p) => p.id) } },
        select: { externalId: true, mapping: { select: { purchasePrice: true } } },
      });
      const price = new Map(links.map((l) => [l.externalId, l.mapping.purchasePrice]));
      suggestions = inStock.map((p) => {
        const pp = price.get(p.id);
        return { productId: p.id, qty: p.stock, unitCost: pp != null ? BigInt(Math.round(Number(pp))) : 0n };
      });
    }

    const ids = [...new Set([...moves.map((m) => m.productId), ...suggestions.map((s) => s.productId)])];
    const products = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, sku: true, mainImage: true, stock: true } });
    return NextResponse.json(
      serialize({
        year,
        defaultWarehouseId: wh.id,
        warehouses: await prisma.accWarehouse.findMany({ where: { isActive: true }, orderBy: [{ isDefault: "desc" }, { code: "asc" }] }),
        lines: moves.map((m) => ({ productId: m.productId, warehouseId: m.warehouseId, qty: m.qty, unitCost: m.unitCost })),
        suggestions,
        products,
        can: { manage: can(guard.access, "ACC_INVENTORY") && can(guard.access, "ACC_COST_VIEW") },
      }),
    );
  } catch (e) {
    return accErrorResponse(e, "[acc-opening-inv]");
  }
}

/** PUT { lines: [{productId, warehouseId, qty, unitCost}] } — بها لازم است، پس ACC_COST_VIEW هم */
export async function PUT(req: Request) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const cost = await requirePermission("ACC_COST_VIEW");
  if (!cost.ok) return NextResponse.json({ error: "ثبت موجودی اول دوره دیدن بهای کالا را لازم دارد" }, { status: 403 });
  try {
    const b = await readJson<{ lines?: { productId: string; warehouseId: string; qty: unknown; unitCost: unknown }[] }>(req);
    const year = await currentYear();
    if (!year) throw new AccError("سال مالی تعریف نشده است", 404);
    const lines = (b.lines ?? []).map((l, i) => {
      const qty = Number(l.qty);
      if (!Number.isInteger(qty) || qty < 0) throw new AccError(`ردیف ${i + 1}: تعداد نامعتبر است`);
      return { productId: String(l.productId), warehouseId: String(l.warehouseId), qty, unitCost: toAmount(l.unitCost, "بها") };
    });
    const v = await prisma.$transaction((tx) => saveOpeningInventory(tx, year.id, lines, actorOf(guard.access)), { timeout: 300_000 });
    return NextResponse.json(serialize({ ok: true, voucher: v ? { id: v.id, number: v.number } : null }));
  } catch (e) {
    return accErrorResponse(e, "[acc-opening-inv]");
  }
}
