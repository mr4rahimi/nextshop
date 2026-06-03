import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

// GET /api/store/newest-products?categoryIds=id1,id2&perCategory=3
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ids = url.searchParams.get("categoryIds")?.split(",").filter(Boolean) ?? [];
  const perCategory = Math.min(12, parseInt(url.searchParams.get("perCategory") ?? "3"));

  if (ids.length === 0) {
    return NextResponse.json([]);
  }

  // از هر دسته perCategory محصول جدید
  const results = await Promise.all(
    ids.map(async (categoryId) => {
      const products = await prisma.product.findMany({
        where: { isActive: true, categoryId },
        orderBy: { createdAt: "desc" },
        take: perCategory,
        include: {
          brand: { select: { title: true, slug: true } },
          category: { select: { id: true, title: true, slug: true } },
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
        },
      });
      return products;
    })
  );

  // flat + serialize
  const flat = results.flat().map(p => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    price: p.price,
    salePrice: p.salePrice,
    shortDescription: p.shortDescription,
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
    brand: p.brand,
    category: p.category,
    image: p.mainImage ?? p.images[0]?.url ?? null,
    stock: p.stock,
    trackStock: p.trackStock,
    lowStockThreshold: p.lowStockThreshold,
  }));

  return NextResponse.json(serialize(flat));
}
