import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const categoryId = url.searchParams.get("categoryId");
  const rootIds = url.searchParams.get("rootIds");

  // --- Initial load: return root categories ---
  if (!categoryId) {
    const ids = rootIds ? rootIds.split(",").filter(Boolean) : null;
    const rootCats = await prisma.category.findMany({
      where: {
        parentId: null,
        isActive: true,
        ...(ids ? { id: { in: ids } } : {}),
      },
      select: { id: true, title: true, slug: true, imageUrl: true },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json({ rootCategories: rootCats });
  }

  // --- Category selected: return subcategories, brands, filterable attribute groups ---

  const cat = await prisma.category.findUnique({
    where: { id: categoryId },
    select: {
      id: true,
      slug: true,
      children: {
        select: { id: true, title: true, slug: true, imageUrl: true },
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!cat) return NextResponse.json({ subcategories: [], brands: [], attributeGroups: [] });

  const catIds = [cat.id, ...cat.children.map((c) => c.id)];

  // Brands in this category tree
  const brandsRaw = await prisma.product.findMany({
    where: { categoryId: { in: catIds }, isActive: true, brandId: { not: null } },
    select: { brand: { select: { id: true, title: true, slug: true, logoUrl: true } } },
    distinct: ["brandId"],
  });
  const brands = brandsRaw
    .map((p) => p.brand)
    .filter((b): b is NonNullable<typeof b> => b !== null)
    .filter((b, i, arr) => arr.findIndex((x) => x.id === b.id) === i);

  // Filterable attribute groups assigned to this category (same logic as categories/[slug] route)
  const attrGroupLinks = await prisma.categoryAttributeGroup.findMany({
    where: { categoryId: cat.id },
    include: {
      attributeGroup: {
        include: {
          attributes: {
            where: { isFilterable: true },
            include: {
              values: {
                where: {
                  products: {
                    some: {
                      product: { isActive: true, categoryId: { in: catIds } },
                    },
                  },
                },
                orderBy: { sortOrder: "asc" },
                select: { id: true, value: true },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  const attributeGroups = attrGroupLinks
    .filter((link) => link.attributeGroup.isActive)
    .map((link) => ({
      id: link.attributeGroup.id,
      title: link.attributeGroup.title,
      attributes: link.attributeGroup.attributes
        .filter((attr) => attr.values.length > 0)
        .map((attr) => ({
          id: attr.id,
          title: attr.title,
          values: attr.values,
        })),
    }))
    .filter((g) => g.attributes.length > 0);

  return NextResponse.json({
    subcategories: cat.children,
    brands,
    attributeGroups,
  });
}
