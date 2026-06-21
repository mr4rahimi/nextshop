import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

// GET /api/store/amazing-products?productIds=id1,id2,id3
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ids = url.searchParams.get("productIds")?.split(",").filter(Boolean) ?? [];

  if (ids.length === 0) {
 
  const products = await prisma.product.findMany({
    where: { isActive: true, salePrice: { not: null } },
    take: 6,
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, slug: true,
      price: true, salePrice: true, mainImage: true,
      stock: true, trackStock: true, lowStockThreshold: true,
      brand: { select: { title: true, slug: true } },
      category: { select: { title: true, slug: true } },
    },
  });
  return NextResponse.json(serialize(products));
}

  const products = await prisma.product.findMany({
    where: { id: { in: ids }, isActive: true },
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
    },
    take: 12,
  });

  const sorted = ids
    .map(id => products.find(p => p.id === id))
    .filter(Boolean) as typeof products;

  const result = sorted.map(p => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    price: p.price,
    salePrice: p.salePrice,
    image: p.mainImage ?? p.images[0]?.url ?? null,
    stock: p.stock,
    trackStock: p.trackStock,
    lowStockThreshold: p.lowStockThreshold,
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
  }));

  return NextResponse.json(serialize(result));
}
