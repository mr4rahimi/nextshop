import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/integration/platform-products?platformCode=hesaban&page=1&pageSize=50&q=
// Returns platform products with their mapping/suggestion status
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const platformCode = searchParams.get("platformCode");
  const page         = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const pageSize     = Math.min(200, parseInt(searchParams.get("pageSize") ?? "50"));
  const q            = searchParams.get("q")?.trim() ?? "";
  const status       = searchParams.get("status"); // "mapped" | "suggested" | "unmapped" | null=all

  if (!platformCode) {
    return NextResponse.json({ error: "platformCode الزامی است" }, { status: 400 });
  }

  const where = {
    platformCode,
    ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
  };

  const [total, products] = await Promise.all([
    prisma.integPlatformProduct.count({ where }),
    prisma.integPlatformProduct.findMany({
      where,
      orderBy: { title: "asc" },
      skip:  (page - 1) * pageSize,
      take:  pageSize,
    }),
  ]);

  // Fetch mappings and suggestions for these product IDs in one query each
  const platformProductIds = products.map((p) => p.platformProductId);

  const [mappings, suggestions] = await Promise.all([
    prisma.integProductMapping.findMany({
      where: { platformCode, platformProductId: { in: platformProductIds }, isActive: true },
      include: { shopProduct: { select: { id: true, title: true, price: true, stock: true } } },
    }),
    prisma.integMappingSuggestion.findMany({
      where: { platformCode, platformProductId: { in: platformProductIds }, status: "PENDING" },
      include: { platform: false },
      orderBy: { confidence: "desc" },
    }),
  ]);

  // Fetch shop product info for suggestions
  const suggestionShopIds = [...new Set(suggestions.map((s) => s.shopProductId))];
  const suggestionShopProducts = suggestionShopIds.length
    ? await prisma.product.findMany({
        where: { id: { in: suggestionShopIds } },
        select: { id: true, title: true, price: true, stock: true },
      })
    : [];
  const shopProductMap = new Map(suggestionShopProducts.map((p) => [p.id, p]));

  // Build lookup maps
  const mappingMap   = new Map(mappings.map((m) => [m.platformProductId, m]));
  const suggestionMap = new Map(suggestions.map((s) => [s.platformProductId, s]));

  const enriched = products.map((p) => {
    const mapping    = mappingMap.get(p.platformProductId);
    const suggestion = suggestionMap.get(p.platformProductId);

    let mappingStatus: "mapped" | "suggested" | "unmapped" = "unmapped";
    if (mapping)    mappingStatus = "mapped";
    else if (suggestion) mappingStatus = "suggested";

    return {
      id:                p.id,
      platformCode:      p.platformCode,
      platformProductId: p.platformProductId,
      title:             p.title,
      sku:               p.sku,
      barcode:           p.barcode,
      stock:             p.stock,
      price:             p.price,
      purchasePrice:     p.purchasePrice,
      unit:              p.unit,
      isEnabled:         p.isEnabled,
      lastFetchedAt:     p.lastFetchedAt,
      mappingStatus,
      mapping: mapping ? {
        id:          mapping.id,
        shopProduct: mapping.shopProduct,
      } : null,
      suggestion: suggestion ? {
        id:          suggestion.id,
        confidence:  suggestion.confidence,
        matchReason: suggestion.matchReason,
        shopProduct: shopProductMap.get(suggestion.shopProductId) ?? null,
      } : null,
    };
  });

  // Filter by status if requested
  const filtered = status
    ? enriched.filter((p) => p.mappingStatus === status)
    : enriched;

  return NextResponse.json({
    items:    filtered,
    total,
    page,
    pageSize,
    hasMore:  page * pageSize < total,
  });
}
