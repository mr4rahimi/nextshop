import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { rangeFrom } from "@/lib/accounting/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?warehouseId&from&to — کاردکس یک کالا */
export async function GET(req: Request, { params }: { params: Promise<{ productId: string }> }) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { productId } = await params;
  const url = new URL(req.url);
  const warehouseId = url.searchParams.get("warehouseId");
  const { from, to } = rangeFrom(url);
  const withCost = can(guard.access, "ACC_COST_VIEW");

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, title: true, sku: true, gtin13: true, mainImage: true, stock: true, lowStockThreshold: true },
  });
  if (!product) return NextResponse.json({ error: "کالا پیدا نشد" }, { status: 404 });

  const where: Prisma.AccStockMoveWhereInput = { productId, ...(warehouseId ? { warehouseId } : {}) };
  const dateWhere = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  const [moves, stocks, cost, warehouses, openingQty] = await Promise.all([
    prisma.accStockMove.findMany({
      where: { ...where, ...(from || to ? { date: dateWhere } : {}) },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      take: 1000,
    }),
    prisma.accStock.findMany({ where: { productId } }),
    prisma.accProductCost.findUnique({ where: { productId } }),
    prisma.accWarehouse.findMany({ orderBy: [{ isDefault: "desc" }, { code: "asc" }] }),
    from ? prisma.accStockMove.aggregate({ where: { ...where, date: { lt: from } }, _sum: { qty: true } }) : null,
  ]);

  // موجودی جاریِ همان انبار (یا کل) — کاردکس سراسری balanceQty دارد، ولی فیلتر انبار جمع جدا می‌خواهد
  let running = openingQty?._sum.qty ?? 0;
  const rows = moves.map((m) => {
    running += m.qty;
    return {
      id: m.id,
      date: m.date,
      type: m.type,
      warehouseId: m.warehouseId,
      qty: m.qty,
      running,
      sourceType: m.sourceType,
      sourceId: m.sourceId,
      note: m.note,
      ...(withCost ? { unitCost: m.unitCost, totalCost: m.totalCost, balanceValue: m.balanceValue, balanceQty: m.balanceQty } : {}),
    };
  });

  return NextResponse.json(
    serialize({
      product,
      stocks,
      warehouses,
      opening: openingQty?._sum.qty ?? 0,
      rows,
      cost: withCost ? cost : null,
      can: { cost: withCost },
    }),
  );
}
