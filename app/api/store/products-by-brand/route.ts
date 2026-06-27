import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const brandId = url.searchParams.get("brandId");
  const count = Math.min(20, parseInt(url.searchParams.get("count") ?? "8"));
  const sort = url.searchParams.get("sort") ?? "newest";
  const productIdsParam = url.searchParams.get("productIds");

  const include = {
    category: { select: { title: true, slug: true } },
    images: { orderBy: { sortOrder: "asc" as const }, take: 1 },
  };

  const mapProduct = (p: any) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    price: p.price,
    salePrice: p.salePrice,
    category: p.category,
    image: p.mainImage ?? p.images[0]?.url ?? null,
    stock: p.stock,
    trackStock: p.trackStock,
    lowStockThreshold: p.lowStockThreshold,
  });

  if (productIdsParam) {
    const productIds = productIdsParam.split(",").filter(Boolean);
    if (productIds.length === 0) return NextResponse.json([]);
    const products = await prisma.product.findMany({
      where: { isActive: true, id: { in: productIds } },
      include,
    });
    const sorted = productIds
      .map(id => products.find(p => p.id === id))
      .filter(Boolean) as typeof products;
    return NextResponse.json(serialize(sorted.map(mapProduct)));
  }

  if (!brandId) return NextResponse.json([]);

  const products = await prisma.product.findMany({
    where: { isActive: true, brandId },
    orderBy: sort === "best_sellers"
      ? [{ orderItems: { _count: "desc" } }, { createdAt: "desc" }]
      : { createdAt: "desc" },
    take: count,
    include,
  });

  return NextResponse.json(serialize(products.map(mapProduct)));
}
