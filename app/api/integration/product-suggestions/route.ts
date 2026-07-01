import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/integration/product-suggestions
// Returns IntegMapping groups where at least one platform link is missing.
// Used by the "پیشنهادات اضافه کردن محصول" page.
export async function GET() {
  const platforms = await prisma.integPlatform.findMany({
    where:  { isActive: true },
    select: { code: true, name: true, type: true },
  });

  const allPlatformCodes = ["shop", ...platforms.map((p) => p.code)];

  const mappings = await prisma.integMapping.findMany({
    where:   { isActive: true },
    include: { links: { where: { isActive: true } } },
    orderBy: { createdAt: "desc" },
    take:    200,
  });

  // Shop product info
  const shopIds = [
    ...new Set(
      mappings.flatMap((m) =>
        m.links.filter((l) => l.platformCode === "shop").map((l) => l.externalId)
      )
    ),
  ];
  const shopProducts = shopIds.length
    ? await prisma.product.findMany({
        where:  { id: { in: shopIds } },
        select: { id: true, title: true, price: true, stock: true, slug: true },
      })
    : [];
  const shopMap = new Map(shopProducts.map((p) => [p.id, p]));

  const suggestions = mappings
    .map((m) => {
      const linkMap = new Map(m.links.map((l) => [l.platformCode, l]));
      const missing = allPlatformCodes.filter((code) => !linkMap.has(code));

      if (missing.length === 0) return null; // کامل است

      const shopLink = linkMap.get("shop");
      const shopProduct = shopLink ? shopMap.get(shopLink.externalId) : null;

      return {
        mappingId: m.id,
        createdAt: m.createdAt,
        links: m.links.map((l) => ({
          id:            l.id,
          platformCode:  l.platformCode,
          externalId:    l.externalId,
          externalTitle: l.externalTitle,
          shopProduct:   l.platformCode === "shop" ? shopProduct : null,
        })),
        missing: missing.map((code) => ({
          platformCode: code,
          platformName: code === "shop" ? "فروشگاه" : (platforms.find((p) => p.code === code)?.name ?? code),
          platformType: code === "shop" ? "shop" : (platforms.find((p) => p.code === code)?.type ?? "MARKETPLACE"),
        })),
      };
    })
    .filter(Boolean);

  return NextResponse.json({ suggestions, total: suggestions.length });
}
