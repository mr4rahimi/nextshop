import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

// ── داده دسته‌بندی (مستقیم از Prisma، بدون HTTP به خود) ──
export async function getCategoryData(slug: string) {
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      parent: { select: { title: true, slug: true } },
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, title: true, slug: true, imageUrl: true },
      },
    },
  });
  if (!category || !category.isActive) return null;

  const catIds = [category.id, ...category.children.map(c => c.id)];

  const [brands, priceAgg, attrGroups] = await Promise.all([
    prisma.brand.findMany({
      where: { isActive: true, products: { some: { isActive: true, categoryId: { in: catIds } } } },
      select: { id: true, title: true, slug: true, logoUrl: true },
      orderBy: { title: "asc" },
    }),
    prisma.product.aggregate({
      where: { isActive: true, categoryId: { in: catIds } },
      _min: { price: true }, _max: { price: true },
    }),
    prisma.categoryAttributeGroup.findMany({
      where: { categoryId: category.id },
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
                },
              },
            },
          },
        },
      },
    }),
  ]);

  return serialize({
    id: category.id,
    title: category.title,
    slug: category.slug,
    description: category.description,
    imageUrl: category.imageUrl,
    seoTitle: category.seoTitle,
    seoDescription: category.seoDescription,
    parent: category.parent,
    children: category.children,
    brands,
    priceRange: {
      min: priceAgg._min.price ?? 0,
      max: priceAgg._max.price ?? 100_000_000,
    },
    attributeGroups: attrGroups.map(ag => ({
      id: ag.id,
      attributeGroup: {
        id: ag.attributeGroup.id,
        title: ag.attributeGroup.title,
        attributes: ag.attributeGroup.attributes.filter(a => a.values.length > 0),
      },
    })).filter(ag => ag.attributeGroup.attributes.length > 0),
  });
}
