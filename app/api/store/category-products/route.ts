import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

// GET /api/store/category-products?categoryId=xxx&limit=12
export async function GET(req: Request) {
  const url = new URL(req.url);
  const categoryId = url.searchParams.get("categoryId");
  const limit = Math.min(24, parseInt(url.searchParams.get("limit") ?? "12"));

  if (!categoryId) return NextResponse.json([]);

  const products = await prisma.product.findMany({
    where: { isActive: true, categoryId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      brand: { select: { title: true, slug: true } },
      category: { select: { id: true, title: true, slug: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
    },
  });

  const result = products.map(p => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    price: p.price,
    salePrice: p.salePrice,
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
    brand: p.brand,
    category: p.category,
    image: p.mainImage ?? p.images[0]?.url ?? null,
    stock: p.stock,
    trackStock: p.trackStock,
    lowStockThreshold: p.lowStockThreshold,
  }));

  return NextResponse.json(serialize(result));
}
