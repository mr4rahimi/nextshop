import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;

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

  if (!category || !category.isActive) {
    return NextResponse.json({ message: "دسته‌بندی یافت نشد" }, { status: 404 });
  }

  // برندهای موجود در این دسته
  const brands = await prisma.brand.findMany({
    where: {
      isActive: true,
      products: { some: { isActive: true, category: { slug } } },
    },
    select: { id: true, title: true, slug: true, logoUrl: true },
    orderBy: { title: "asc" },
  });

  // محدوده قیمت
  const priceAgg = await prisma.product.aggregate({
    where: { isActive: true, category: { slug } },
    _min: { price: true },
    _max: { price: true },
  });

  // ویژگی‌های دسته‌بندی
  const attributeGroups = await prisma.categoryAttributeGroup.findMany({
    where: { categoryId: category.id },
    include: {
      attributeGroup: {
        include: {
          attributes: {
            where: { isFilterable: true },
            include: { 
              values: { 
                orderBy: { sortOrder: "asc" },
                where: {
                  // فقط مقادیری که در محصولات این دسته استفاده شده‌اند
                  products: {
                    some: {
                      product: {
                        isActive: true,
                        categoryId: category.id
                      }
                    }
                  }
                }
              } 
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  return NextResponse.json(
    serialize({
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
      attributeGroups: attributeGroups.map(ag => ({
        id: ag.id,
        attributeGroup: {
          id: ag.attributeGroup.id,
          title: ag.attributeGroup.title,
          attributes: ag.attributeGroup.attributes.filter(attr => attr.values.length > 0),
        },
      })).filter(ag => ag.attributeGroup.attributes.length > 0),
    })
  );
}
