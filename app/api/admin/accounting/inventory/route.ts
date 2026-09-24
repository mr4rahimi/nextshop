import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { productSearchWhere, stockRows } from "@/lib/accounting/inventory/query";
import { ensureDefaultWarehouse } from "@/lib/accounting/inventory/docs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?q&filter=all|instock|negative|low&warehouseId&take — موجودی کالاها.
 * بها و ارزش فقط با ACC_COST_VIEW.
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const url = new URL(req.url);
  const filter = url.searchParams.get("filter") ?? "instock";
  const warehouseId = url.searchParams.get("warehouseId");
  const take = Math.min(Number(url.searchParams.get("take")) || 100, 300);
  const withCost = can(guard.access, "ACC_COST_VIEW");

  await prisma.$transaction((tx) => ensureDefaultWarehouse(tx));
  const warehouses = await prisma.accWarehouse.findMany({ orderBy: [{ isDefault: "desc" }, { code: "asc" }] });

  const where: Prisma.ProductWhereInput = { ...productSearchWhere(url.searchParams.get("q")) };
  if (filter === "instock" || filter === "negative") {
    const ids = (
      await prisma.accStock.findMany({
        where: { ...(warehouseId ? { warehouseId } : {}), qty: filter === "negative" ? { lt: 0 } : { not: 0 } },
        select: { productId: true },
        distinct: ["productId"],
      })
    ).map((s) => s.productId);
    where.id = { in: ids };
  }

  const products = await prisma.product.findMany({
    where,
    orderBy: { title: "asc" },
    take: filter === "low" ? 1000 : take,
    select: { id: true, title: true, sku: true, mainImage: true, stock: true, lowStockThreshold: true, trackStock: true },
  });
  const rows = await stockRows(products.map((p) => p.id), withCost);
  let items = products.map((p) => ({
    id: p.id,
    title: p.title,
    sku: p.sku,
    image: p.mainImage,
    siteStock: p.stock,
    lowStockThreshold: p.lowStockThreshold,
    ...rows.get(p.id)!,
  }));
  if (filter === "low") items = items.filter((i) => i.qty <= i.lowStockThreshold).slice(0, take);

  const totals = withCost
    ? await prisma.accProductCost.aggregate({ _sum: { totalValue: true } })
    : null;
  const [negative, kinds] = await Promise.all([
    prisma.accStock.findMany({ where: { qty: { lt: 0 } }, select: { productId: true }, distinct: ["productId"] }),
    prisma.accStock.findMany({ where: { qty: { not: 0 } }, select: { productId: true }, distinct: ["productId"] }),
  ]);

  return NextResponse.json(
    serialize({
      items,
      warehouses,
      summary: { value: totals?._sum.totalValue ?? null, products: kinds.length, negative: negative.length },
      can: { cost: withCost, manage: can(guard.access, "ACC_INVENTORY") },
    }),
  );
}
