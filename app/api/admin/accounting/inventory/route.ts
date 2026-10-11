import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { stockRows } from "@/lib/accounting/inventory/query";
import { itemCards, itemSearchWhere } from "@/lib/accounting/inventory/items";
import { listGroups } from "@/lib/accounting/inventory/catalog";
import { ensureDefaultWarehouse } from "@/lib/accounting/inventory/docs";
import { itemLinks } from "@/lib/accounting/inventory/to-product";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?q&filter=all|instock|negative|low|noproduct|inactive&warehouseId&groupId&take — موجودی کالاها
 * (`AccItem`، docs/plans/inventory-items.md). «همه» یعنی کالاهای فعال.
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

  const where: Prisma.AccItemWhereInput = { ...(await itemSearchWhere(url.searchParams.get("q"))), isActive: filter !== "inactive" };
  if (filter === "instock" || filter === "negative") {
    const ids = (
      await prisma.accStock.findMany({
        where: { ...(warehouseId ? { warehouseId } : {}), qty: filter === "negative" ? { lt: 0 } : { not: 0 } },
        select: { productId: true },
        distinct: ["productId"],
      })
    ).map((s) => s.productId);
    where.AND = [{ id: { in: ids } }];
    delete where.isActive;
  }
  const groupId = url.searchParams.get("groupId");
  if (groupId) {
    // گروه و همه‌ی زیرگروه‌هایش
    const groups = await listGroups();
    const ids = new Set([groupId]);
    for (let added = true; added; ) {
      added = false;
      for (const g of groups) {
        if (g.parentId && ids.has(g.parentId) && !ids.has(g.id)) {
          ids.add(g.id);
          added = true;
        }
      }
    }
    where.groupId = { in: [...ids] };
  }
  if (filter === "noproduct") {
    // نه محصول هم‌شناسه، نه تنوعی که به کالا وصل باشد (فاز ۵)
    const bare = await prisma.$queryRaw<{ id: string }[]>`SELECT i.id FROM "AccItem" i WHERE NOT EXISTS (SELECT 1 FROM "Product" p WHERE p.id = i.id)
      AND NOT EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."accItemId" = i.id)`;
    where.AND = [{ id: { in: bare.map((r) => r.id) } }];
  }

  const found = await prisma.accItem.findMany({
    where,
    orderBy: { title: "asc" },
    take: filter === "low" ? 1000 : take,
    select: { id: true },
  });
  const ids = found.map((i) => i.id);
  const [cards, rows, links, flags] = await Promise.all([
    itemCards(ids),
    stockRows(ids, withCost),
    itemLinks(ids),
    prisma.accItem.findMany({ where: { id: { in: ids }, sellOnline: false }, select: { id: true } }),
  ]);
  const offline = new Set(flags.map((f) => f.id));
  let items = ids.map((id) => {
    const c = cards.get(id)!;
    return {
      id,
      title: c.title,
      sku: c.code,
      code: c.code,
      image: c.image,
      hasProduct: c.hasProduct || links.has(id),
      /** محصول/تنوع سایت — `variant` خالی یعنی کالای خود محصول */
      link: links.get(id) ?? null,
      sellOnline: !offline.has(id),
      isActive: c.isActive,
      siteStock: c.siteStock,
      lowStockThreshold: c.lowStockThreshold,
      ...rows.get(id)!,
    };
  });
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
