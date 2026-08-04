import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const categoryId = url.searchParams.get("categoryId");

  if (!categoryId) {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, title: true, slug: true },
      orderBy: { title: "asc" },
    });
    return NextResponse.json({ categories });
  }

  const cat = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, slug: true, children: { select: { id: true } } },
  });
  if (!cat) return NextResponse.json({ brands: [], attributes: [] });

  const catIds = [cat.id, ...cat.children.map(c => c.id)];

  const brands = await prisma.brand.findMany({
    where: { isActive: true, products: { some: { isActive: true, categoryId: { in: catIds } } } },
    select: { title: true, slug: true },
    orderBy: { title: "asc" },
  });

  const links = await prisma.categoryAttributeGroup.findMany({
    where: { categoryId: cat.id },
    include: {
      attributeGroup: {
        include: {
          attributes: {
            where: { isFilterable: true },
            orderBy: { sortOrder: "asc" },
            include: {
              values: {
                orderBy: { sortOrder: "asc" },
                where: { products: { some: { product: { isActive: true, categoryId: { in: catIds } } } } },
                select: { value: true, slug: true },
              },
            },
          },
        },
      },
    },
  });

  const attributes = links.flatMap(l => l.attributeGroup.attributes)
    .filter(a => a.slug && a.values.length > 0)
    .map(a => ({
      title: a.title,
      slug: a.slug,
      values: a.values.filter(v => v.slug).map(v => ({ value: v.value, slug: v.slug })),
    }));

  return NextResponse.json({ categorySlug: cat.slug, brands, attributes });
}