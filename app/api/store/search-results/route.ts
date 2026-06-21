import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

// attr param: multiple ?attr=attributeValueId (same as /api/products)
// Matches the filtering behavior of the category/products listing pages

export async function GET(req: Request) {
  const url = new URL(req.url);
  const categoryId = url.searchParams.get("categoryId");
  const brandId = url.searchParams.get("brandId");
  const attrValues = url.searchParams.getAll("attr");
  const pageSize = Math.min(48, Math.max(1, Number(url.searchParams.get("pageSize") ?? "4")));
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));

  const where: any = { isActive: true };

  if (categoryId) {
    const cat = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, children: { select: { id: true } } },
    });
    if (cat) {
      where.categoryId = { in: [cat.id, ...cat.children.map((c) => c.id)] };
    }
  }

  if (brandId) where.brandId = brandId;

  if (attrValues.length > 0) {
    where.AND = where.AND ?? [];
    where.AND.push({
      attributes: {
        some: {
          attributeValueId: { in: attrValues },
        },
      },
    });
  }

  const [total, items] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        slug: true,
        mainImage: true,
        price: true,
        salePrice: true,
        ratingAvg: true,
        ratingCount: true,
        stock: true,
        trackStock: true,
        brand: { select: { title: true, slug: true } },
        category: { select: { title: true, slug: true } },
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
      },
    }),
  ]);

  return NextResponse.json(
    serialize({
      total,
      page,
      pageSize,
      items: items.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        image: p.images[0]?.url ?? p.mainImage ?? null,
        price: p.price,
        salePrice: p.salePrice,
        ratingAvg: p.ratingAvg,
        ratingCount: p.ratingCount,
        stock: p.stock,
        trackStock: p.trackStock,
        brand: p.brand,
        category: p.category,
      })),
    })
  );
}
