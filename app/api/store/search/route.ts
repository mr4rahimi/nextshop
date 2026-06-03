import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url   = new URL(req.url);
  const q     = url.searchParams.get("q")?.trim() ?? "";
  const page  = parseInt(url.searchParams.get("page") ?? "1");
  const limit = parseInt(url.searchParams.get("limit") ?? "6");

  if (!q || q.length < 2) {
    return NextResponse.json({ products: [], total: 0, suggestions: { categories: [], brands: [] } });
  }

  const where = {
    isActive: true,
    OR: [
      { title:    { contains: q, mode: "insensitive" as const } },
      { brand:    { title: { contains: q, mode: "insensitive" as const } } },
      { category: { title: { contains: q, mode: "insensitive" as const } } },
    ],
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, title: true, slug: true,
        price: true, salePrice: true,
        mainImage: true,
        stock: true,
        trackStock: true,
        lowStockThreshold: true,
        images:   { take: 1, select: { url: true } },
        brand:    { select: { title: true } },
        category: { select: { title: true, slug: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  const [cats, brands] = await Promise.all([
    prisma.category.findMany({
      where: { title: { contains: q, mode: "insensitive" as const }, isActive: true },
      take: 3, select: { title: true, slug: true, imageUrl: true },
    }),
    prisma.brand.findMany({
      where: { title: { contains: q, mode: "insensitive" as const }, isActive: true },
      take: 2, select: { title: true, slug: true, logoUrl: true },
    }),
  ]);

  return NextResponse.json(serialize({
    products, total,
    suggestions: { categories: cats, brands },
  }));
}
