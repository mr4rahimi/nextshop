import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const category = url.searchParams.get("category")?.trim();
  const brand = url.searchParams.get("brand")?.trim();
  const sort = url.searchParams.get("sort")?.trim() ?? "newest";

  const page = Math.max(1, toInt(url.searchParams.get("page"), 1));
  const pageSize = Math.min(48, Math.max(1, toInt(url.searchParams.get("pageSize"), 12)));

  const minPriceStr = url.searchParams.get("minPrice");
  const maxPriceStr = url.searchParams.get("maxPrice");

  const attributeValues = url.searchParams.getAll("attr");



  const where: any = { isActive: true };

  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { shortDescription: { contains: q, mode: "insensitive" } },
    ];
  }

  if (category) {
  const cat = await prisma.category.findUnique({
    where: { slug: category },
    select: { id: true, children: { select: { id: true } } },
  });
  if (cat) {
    const categoryIds = [cat.id, ...cat.children.map(c => c.id)];
    where.categoryId = { in: categoryIds };
  } else {
    where.category = { slug: category };
  }
}
  if (brand) where.brand = { slug: brand };

  const minPrice = minPriceStr ? BigInt(minPriceStr) : null;
  const maxPrice = maxPriceStr ? BigInt(maxPriceStr) : null;

  if (minPrice !== null || maxPrice !== null) {
    where.AND = where.AND ?? [];
    if (minPrice !== null) {
      where.AND.push({
        OR: [
          { salePrice: { gte: minPrice } },
          { AND: [{ salePrice: null }, { price: { gte: minPrice } }] },
        ],
      });
    }
    if (maxPrice !== null) {
      where.AND.push({
        OR: [
          { salePrice: { lte: maxPrice } },
          { AND: [{ salePrice: null }, { price: { lte: maxPrice } }] },
        ],
      });
    }
  }

  let orderBy: any = { createdAt: "desc" };
  if (sort === "price_asc") orderBy = [{ salePrice: "asc" }, { price: "asc" }];
  if (sort === "price_desc") orderBy = [{ salePrice: "desc" }, { price: "desc" }];
  if (sort === "popular") orderBy = { ratingCount: "desc" };
  if (attributeValues.length > 0) {
    where.AND = where.AND ?? [];
    where.AND.push({
      attributes: {
        some: {
          attributeValueId: { in: attributeValues }
        }
      }
    });
  }
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        brand: { select: { title: true, slug: true, logoUrl: true } },
        category: { select: { title: true, slug: true } },
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return NextResponse.json(
    serialize({
      page,
      pageSize,
      total,
      items: items.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        mainImage: p.mainImage,
        price: p.price,
        salePrice: p.salePrice,
        ratingAvg: p.ratingAvg,
        ratingCount: p.ratingCount,
        brand: p.brand,
        category: p.category,
        image: p.images[0]?.url ?? p.mainImage ?? null,
        stock: p.stock,
        trackStock: p.trackStock,
        lowStockThreshold: p.lowStockThreshold,
      })),
    })
  );
}