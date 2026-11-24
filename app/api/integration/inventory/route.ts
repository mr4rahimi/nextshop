import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStockSource } from "@/lib/integration/core/config";
import { setManualMappingStock } from "@/lib/integration/core/inventory";
import { pushPriceForMapping } from "@/lib/integration/core/pricing";

export const dynamic = "force-dynamic";

/**
 * موجودی محصولات نگاشت‌شده — docs/integrations/settings-and-guide.md
 *
 * GET ?page=&perPage=&q=  فهرست با موجودی سایت و نگاشت و منبع موجودی
 * PATCH { mappingId(s), syncStockEnabled }        روشن/خاموش مدیریت موجودی
 * PATCH { mappingId, stock?, purchasePrice? }     ورود دستی (فقط منبع «سایت»)
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const perPage = Math.min(100, Math.max(10, Number(sp.get("perPage") ?? 30)));
  const q = (sp.get("q") ?? "").trim();

  const where: Prisma.IntegMappingWhereInput = { isActive: true };
  if (q) {
    const shopIds = (
      await prisma.product.findMany({ where: { title: { contains: q, mode: "insensitive" } }, select: { id: true }, take: 500 })
    ).map((p) => p.id);
    where.links = {
      some: {
        OR: [
          { externalTitle: { contains: q, mode: "insensitive" } },
          { externalId: q },
          ...(shopIds.length ? [{ platformCode: "shop", externalId: { in: shopIds } }] : []),
        ],
      },
    };
  }

  const [total, mappings, source, platforms] = await Promise.all([
    prisma.integMapping.count({ where }),
    prisma.integMapping.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { links: { where: { isActive: true } } },
    }),
    getStockSource(),
    prisma.integPlatform.findMany({ select: { code: true, name: true, isActive: true } }),
  ]);

  const shopIds = mappings.flatMap((m) => m.links.filter((l) => l.platformCode === "shop").map((l) => l.externalId));
  const [shopProducts, variantCounts] = shopIds.length
    ? await Promise.all([
        prisma.product.findMany({ where: { id: { in: shopIds } }, select: { id: true, title: true, mainImage: true, stock: true } }),
        prisma.productVariant.groupBy({ by: ["productId"], where: { productId: { in: shopIds } }, _count: { _all: true } }),
      ])
    : [[], []];
  const shopMap = new Map(shopProducts.map((p) => [p.id, p]));
  const hasVariants = new Set(variantCounts.map((v) => v.productId));
  const names = new Map(platforms.map((p) => [p.code, p]));

  const items = mappings.map((m) => {
    const shopId = m.links.find((l) => l.platformCode === "shop")?.externalId;
    return {
      id: m.id,
      stock: m.stock,
      syncStockEnabled: m.syncStockEnabled,
      lastStockSyncAt: m.lastStockSyncAt,
      lastHesabanStock: m.lastHesabanStock,
      purchasePrice: m.purchasePrice,
      purchasePriceSource: m.purchasePriceSource,
      hasVariants: shopId ? hasVariants.has(shopId) : false,
      links: m.links
        // سرویس خاموش در فهرست نمی‌آید
        .filter((l) => l.platformCode === "shop" || names.get(l.platformCode)?.isActive)
        .map((l) => ({
          platformCode: l.platformCode,
          platformName: l.platformCode === "shop" ? "سایت" : names.get(l.platformCode)?.name ?? l.platformCode,
          externalId: l.externalId,
          externalTitle: l.externalTitle,
          shopProduct: l.platformCode === "shop" ? shopMap.get(l.externalId) ?? null : null,
        })),
    };
  });

  return NextResponse.json({ total, page, perPage, source, items });
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    mappingId?: string;
    mappingIds?: string[];
    syncStockEnabled?: boolean;
    stock?: number;
    purchasePrice?: number | null;
  };

  // ورود دستی موجودی/قیمت خرید
  if (body.stock !== undefined || body.purchasePrice !== undefined) {
    if (!body.mappingId) return NextResponse.json({ error: "mappingId الزامی است" }, { status: 400 });
    const source = await getStockSource();

    if (body.stock !== undefined) {
      if (source !== "site") {
        return NextResponse.json(
          {
            error:
              source === "internal"
                ? "موجودی از حسابداری داخلی می‌آید؛ با فاکتور خرید، اول دوره یا انبارگردانی تغییرش دهید"
                : "موجودی از حسابان وب خوانده می‌شود؛ در حسابان تغییرش دهید و «دریافت موجودی از حسابان» را بزنید",
          },
          { status: 409 },
        );
      }
      const n = Number(body.stock);
      if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: "موجودی نامعتبر است" }, { status: 400 });
      try {
        await setManualMappingStock(body.mappingId, n);
      } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "ذخیره نشد" }, { status: 400 });
      }
    }

    if (body.purchasePrice !== undefined) {
      const price = body.purchasePrice === null ? null : Number(body.purchasePrice);
      if (price !== null && (!Number.isFinite(price) || price < 0)) {
        return NextResponse.json({ error: "قیمت خرید نامعتبر است" }, { status: 400 });
      }
      await prisma.integMapping.update({
        where: { id: body.mappingId },
        data: { purchasePrice: price, purchasePriceSource: "MANUAL" },
      });
      await pushPriceForMapping(body.mappingId).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  }

  const ids = body.mappingIds ?? (body.mappingId ? [body.mappingId] : []);
  if (!ids.length || body.syncStockEnabled === undefined) {
    return NextResponse.json({ error: "mappingId الزامی است" }, { status: 400 });
  }

  await prisma.integMapping.updateMany({
    where: { id: { in: ids } },
    data: { syncStockEnabled: body.syncStockEnabled },
  });

  return NextResponse.json({ ok: true });
}
