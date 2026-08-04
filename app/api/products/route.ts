import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

function toInt(v: string | null, fallback: number) {
  if (v === null || v.trim() === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const RESERVED_PARAMS = new Set([
  "q", "category", "brand", "sort", "page", "pageSize",
  "minPrice", "maxPrice", "attr",
]);

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

  const legacyValueIds = url.searchParams.getAll("attr").filter(Boolean);

  // فرمت جدید: ?print-type=laser&color=red,blue
  const slugFilters: Record<string, string[]> = {};
  for (const [key, val] of url.searchParams.entries()) {
    if (RESERVED_PARAMS.has(key) || key.startsWith("utm_")) continue;
    const vals = val.split(",").map(s => s.trim()).filter(Boolean);
    if (vals.length) slugFilters[key] = [...(slugFilters[key] ?? []), ...vals];
  }



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
  if (brand) {
    const brandSlugs = brand.split(",").map(s => s.trim()).filter(Boolean);
    if (brandSlugs.length === 0) {
      return NextResponse.json(serialize({ page, pageSize, total: 0, items: [] }));
    }
    where.brand = brandSlugs.length > 1 ? { slug: { in: brandSlugs } } : { slug: brandSlugs[0] };
  }

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
  // هر گروه = مقادیر یک ویژگی. داخل گروه OR، بین گروه‌ها AND.
  const valueGroups: string[][] = [];

  const slugKeys = Object.keys(slugFilters);
  if (slugKeys.length > 0) {
    const attrs = await prisma.attribute.findMany({
      where: { slug: { in: slugKeys } },
      select: { slug: true, values: { select: { id: true, slug: true } } },
    });
    // ادغام بر اساس slug — چون slug ویژگی فقط داخل گروه یکتاست
    const bySlug = new Map<string, string[]>();
    for (const a of attrs) {
      const wanted = slugFilters[a.slug] ?? [];
      const ids = a.values.filter(v => v.slug && wanted.includes(v.slug)).map(v => v.id);
      if (ids.length) bySlug.set(a.slug, [...(bySlug.get(a.slug) ?? []), ...ids]);
    }
    valueGroups.push(...bySlug.values());

    // فیلتری خواسته شده که هیچ مقداری براش پیدا نشد → نتیجه خالی، نه همه‌چیز
    if (bySlug.size < slugKeys.length) {
      return NextResponse.json(
        serialize({ page, pageSize, total: 0, items: [] })
      );
    }
  }

  if (legacyValueIds.length > 0) {
    const vals = await prisma.attributeValue.findMany({
      where: { id: { in: legacyValueIds } },
      select: { id: true, attributeId: true },
    });
    const byAttr = new Map<string, string[]>();
    for (const v of vals) {
      byAttr.set(v.attributeId, [...(byAttr.get(v.attributeId) ?? []), v.id]);
    }
    valueGroups.push(...byAttr.values());
  }

  for (const ids of valueGroups) {
    where.AND = where.AND ?? [];
    where.AND.push({ attributes: { some: { attributeValueId: { in: ids } } } });
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