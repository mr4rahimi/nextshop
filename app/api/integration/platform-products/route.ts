import { NextRequest, NextResponse } from "next/server";
import { serialize } from "@/lib/serialize";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/integration/platform-products?platformCode=hesaban&page=1&pageSize=50&q=
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const platformCode = searchParams.get("platformCode");
  const page         = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const pageSize     = Math.min(200, parseInt(searchParams.get("pageSize") ?? "50"));
  const q            = searchParams.get("q")?.trim() ?? "";

  if (!platformCode) {
    return NextResponse.json({ error: "platformCode الزامی است" }, { status: 400 });
  }

  const status = searchParams.get("status"); // mapped | suggested | unmapped

  // شمارش و فیلتر وضعیت سمت سرور — فیلتر روی همان صفحه‌ی بارشده شمارش غلط می‌داد
  const [mappedIds, suggestedIds] = await Promise.all([
    prisma.integMappingLink
      .findMany({ where: { platformCode, isActive: true, mapping: { isActive: true } }, select: { externalId: true } })
      .then((r) => r.map((l) => l.externalId)),
    prisma.integMappingSuggestion
      .findMany({ where: { platformCode, status: "PENDING" }, select: { platformProductId: true }, distinct: ["platformProductId"] })
      .then((r) => r.map((s) => s.platformProductId)),
  ]);
  const mappedSet = new Set(mappedIds);
  const suggestedOnly = suggestedIds.filter((id) => !mappedSet.has(id));

  const search = q
    ? { OR: [{ title: { contains: q, mode: "insensitive" as const } }, { sku: q }, { platformProductId: q }] }
    : {};
  const statusWhere =
    status === "mapped"
      ? { platformProductId: { in: mappedIds } }
      : status === "suggested"
        ? { platformProductId: { in: suggestedOnly } }
        : status === "unmapped"
          ? { platformProductId: { notIn: [...mappedIds, ...suggestedOnly] } }
          : {};
  const where = { platformCode, ...search, ...statusWhere };

  const [all, mappedCount, suggestedCount] = await Promise.all([
    prisma.integPlatformProduct.count({ where: { platformCode, ...search } }),
    prisma.integPlatformProduct.count({ where: { platformCode, ...search, platformProductId: { in: mappedIds } } }),
    prisma.integPlatformProduct.count({ where: { platformCode, ...search, platformProductId: { in: suggestedOnly } } }),
  ]);
  const counts = { all, mapped: mappedCount, suggested: suggestedCount, unmapped: Math.max(0, all - mappedCount - suggestedCount) };
  const lastFetchedAt = (await prisma.integPlatformProduct.aggregate({ where: { platformCode }, _max: { lastFetchedAt: true } }))._max.lastFetchedAt;

  const [total, products] = await Promise.all([
    prisma.integPlatformProduct.count({ where }),
    prisma.integPlatformProduct.findMany({
      where,
      orderBy: { title: "asc" },
      skip:  (page - 1) * pageSize,
      take:  pageSize,
    }),
  ]);

  const platformProductIds = products.map((p) => p.platformProductId);

  // پیدا کردن لینک‌های موجود برای این محصولات
  const [links, suggestions] = await Promise.all([
    prisma.integMappingLink.findMany({
      where: { platformCode, externalId: { in: platformProductIds }, isActive: true, mapping: { isActive: true } },
      include: {
        mapping: {
          include: { links: { where: { isActive: true } } },
        },
      },
    }),
    prisma.integMappingSuggestion.findMany({
      where: { platformCode, platformProductId: { in: platformProductIds }, status: "PENDING" },
      orderBy: { confidence: "desc" },
    }),
  ]);

  // اطلاعات محصول فروشگاه برای لینک‌های shop
  const shopIds = [
    ...new Set([
      ...links.flatMap((l) => l.mapping.links.filter((ml) => ml.platformCode === "shop").map((ml) => ml.externalId)),
    ]),
  ];
  const suggestionShopIds = [...new Set(suggestions.map((s) => s.shopProductId))];
  const allShopIds = [...new Set([...shopIds, ...suggestionShopIds])];

  const shopProducts = allShopIds.length
    ? await prisma.product.findMany({
        where:  { id: { in: allShopIds } },
        select: { id: true, title: true, price: true, stock: true, mainImage: true, sku: true },
      })
    : [];
  const shopMap = new Map(shopProducts.map((p) => [p.id, p]));

  const linkMap      = new Map(links.map((l) => [l.externalId, l]));
  const suggestionMap = new Map(suggestions.map((s) => [s.platformProductId, s]));

  const enriched = products.map((p) => {
    const link       = linkMap.get(p.platformProductId);
    const suggestion = suggestionMap.get(p.platformProductId);

    let mappingStatus: "mapped" | "suggested" | "unmapped" = "unmapped";
    if (link)       mappingStatus = "mapped";
    else if (suggestion) mappingStatus = "suggested";

    const allLinks = link?.mapping.links ?? [];
    const shopLink = allLinks.find((l) => l.platformCode === "shop");

    return {
      id:                p.id,
      platformCode:      p.platformCode,
      platformProductId: p.platformProductId,
      title:             p.title,
      sku:               p.sku,
      stock:             p.stock,
      price:             p.price,
      purchasePrice:     p.purchasePrice,
      unit:              p.unit,
      lastFetchedAt:     p.lastFetchedAt,
      mappingStatus,
      mappingId:    link?.mappingId ?? null,
      mappingLinkId: link?.id ?? null,
      shopProduct:  shopLink ? (shopMap.get(shopLink.externalId) ?? null) : null,
      allLinks:     allLinks.map((l) => ({
        id:            l.id,
        platformCode:  l.platformCode,
        externalId:    l.externalId,
        externalTitle: l.externalTitle,
      })),
      suggestion: suggestion ? {
        id:          suggestion.id,
        confidence:  suggestion.confidence,
        matchReason: suggestion.matchReason,
        shopProduct: shopMap.get(suggestion.shopProductId) ?? null,
      } : null,
    };
  });

  return NextResponse.json(serialize({
    items:   enriched,
    total,
    counts,
    lastFetchedAt,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  }));
}
