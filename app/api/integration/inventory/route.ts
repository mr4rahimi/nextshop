import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/integration/inventory?page=1&perPage=30
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const perPage = Math.min(100, Math.max(10, Number(sp.get("perPage") ?? 30)));

  const where = { isActive: true };

  const [total, mappings] = await Promise.all([
    prisma.integMapping.count({ where }),
    prisma.integMapping.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { links: { where: { isActive: true } } },
    }),
  ]);

  const shopIds = mappings.flatMap((m) => m.links.filter((l) => l.platformCode === "shop").map((l) => l.externalId));
  const shopProducts = shopIds.length
    ? await prisma.product.findMany({
        where: { id: { in: shopIds } },
        select: { id: true, title: true, mainImage: true, stock: true },
      })
    : [];
  const shopMap = new Map(shopProducts.map((p) => [p.id, p]));

  const items = mappings.map((m) => ({
    id: m.id,
    stock: m.stock,
    syncStockEnabled: m.syncStockEnabled,
    lastStockSyncAt: m.lastStockSyncAt,
    lastHesabanStock: m.lastHesabanStock,
    links: m.links.map((l) => ({
      platformCode: l.platformCode,
      externalId: l.externalId,
      externalTitle: l.externalTitle,
      shopProduct: l.platformCode === "shop" ? shopMap.get(l.externalId) ?? null : null,
    })),
  }));

  return NextResponse.json({ total, page, perPage, items });
}

// PATCH — روشن/خاموش کردن مدیریت موجودی برای یک یا چند نگاشت
// body: { mappingId: string, syncStockEnabled: boolean } یا { mappingIds: string[], syncStockEnabled }
export async function PATCH(req: NextRequest) {
  const body = await req.json() as {
    mappingId?: string;
    mappingIds?: string[];
    syncStockEnabled: boolean;
  };

  const ids = body.mappingIds ?? (body.mappingId ? [body.mappingId] : []);
  if (!ids.length) return NextResponse.json({ error: "mappingId الزامی است" }, { status: 400 });

  await prisma.integMapping.updateMany({
    where: { id: { in: ids } },
    data: { syncStockEnabled: body.syncStockEnabled },
  });

  return NextResponse.json({ ok: true });
}