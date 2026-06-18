import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;

  const brand = await prisma.brand.findUnique({
    where: { slug },
  });

  if (!brand || !brand.isActive) {
    return NextResponse.json({ message: "برند یافت نشد" }, { status: 404 });
  }

  const priceAgg = await prisma.product.aggregate({
    where: { isActive: true, brand: { slug } },
    _min: { price: true },
    _max: { price: true },
  });

  const categories = await prisma.category.findMany({
    where: {
      isActive: true,
      products: { some: { isActive: true, brand: { slug } } },
    },
    select: { id: true, title: true, slug: true, imageUrl: true },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(
    serialize({
      id: brand.id,
      title: brand.title,
      slug: brand.slug,
      description: brand.description,
      logoUrl: brand.logoUrl,
      seoTitle: brand.seoTitle,
      seoDescription: brand.seoDescription,
      categories,
      priceRange: {
        min: priceAgg._min.price ?? 0,
        max: priceAgg._max.price ?? 100_000_000,
      },
    })
  );
}
