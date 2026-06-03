import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export async function GET() {
  const [brands, categories, priceAgg] = await Promise.all([
    prisma.brand.findMany({
      where: { isActive: true },
      select: { id: true, title: true, slug: true, logoUrl: true },
      orderBy: { title: "asc" },
    }),
    prisma.category.findMany({
      where: { isActive: true, parentId: null },
      select: { id: true, title: true, slug: true, imageUrl: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.product.aggregate({
      where: { isActive: true },
      _min: { price: true },
      _max: { price: true },
    }),
  ]);

  return NextResponse.json(
    serialize({
      brands,
      categories,
      priceRange: {
        min: priceAgg._min.price ?? 0,
        max: priceAgg._max.price ?? 100_000_000,
      },
    })
  );
}