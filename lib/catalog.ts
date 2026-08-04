import { prisma } from "@/lib/prisma";

export const RESERVED_PARAMS = new Set([
  "q", "category", "brand", "sort", "page", "pageSize",
  "minPrice", "maxPrice", "attr",
]);

export const SORTS = ["newest", "popular", "price_asc", "price_desc"] as const;
export type SortType = (typeof SORTS)[number];

export interface CatalogQuery {
  categorySlug?: string;
  brandSlugs: string[];
  /** attributeSlug -> valueSlugs */
  attrFilters: Record<string, string[]>;
  minPrice?: string;
  maxPrice?: string;
  sort: SortType;
  page: number;
  pageSize: number;
  q?: string;
}

/** پارس یکنواخت پارامترها — چه از URLSearchParams چه از searchParams صفحه */
export function parseCatalogQuery(
  sp: URLSearchParams | Record<string, string | string[] | undefined>,
  defaults: { pageSize?: number } = {}
): CatalogQuery {
  const get = (k: string): string | undefined => {
    if (sp instanceof URLSearchParams) return sp.get(k) ?? undefined;
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const entries = (): [string, string][] => {
    if (sp instanceof URLSearchParams) return [...sp.entries()];
    return Object.entries(sp).flatMap(([k, v]) =>
      v === undefined ? [] : (Array.isArray(v) ? v : [v]).map(x => [k, x] as [string, string])
    );
  };

  const split = (v?: string) => (v ?? "").split(",").map(s => s.trim()).filter(Boolean);

  const attrFilters: Record<string, string[]> = {};
  for (const [k, v] of entries()) {
    if (RESERVED_PARAMS.has(k) || k.startsWith("utm_")) continue;
    const vals = split(v);
    if (vals.length) attrFilters[k] = [...(attrFilters[k] ?? []), ...vals];
  }

  const rawSort = get("sort") ?? "newest";
  const pageNum = parseInt(get("page") ?? "1");

  return {
    categorySlug: get("category"),
    brandSlugs: split(get("brand")),
    attrFilters,
    minPrice: get("minPrice"),
    maxPrice: get("maxPrice"),
    sort: (SORTS as readonly string[]).includes(rawSort) ? (rawSort as SortType) : "newest",
    page: Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1,
    pageSize: defaults.pageSize ?? 12,
    q: get("q")?.trim() || undefined,
  };
}

/** ساخت where — برگرداندن null یعنی فیلتر نامعتبر → نتیجه خالی */
export async function buildCatalogWhere(
  cq: CatalogQuery,
  legacyValueIds: string[] = []
): Promise<any | null> {
  const where: any = { isActive: true };

  if (cq.q) {
    where.OR = [
      { title: { contains: cq.q, mode: "insensitive" } },
      { shortDescription: { contains: cq.q, mode: "insensitive" } },
    ];
  }

  if (cq.categorySlug) {
    const cat = await prisma.category.findUnique({
      where: { slug: cq.categorySlug },
      select: { id: true, children: { select: { id: true } } },
    });
    if (!cat) return null;
    where.categoryId = { in: [cat.id, ...cat.children.map(c => c.id)] };
  }

  if (cq.brandSlugs.length) {
    where.brand = cq.brandSlugs.length > 1
      ? { slug: { in: cq.brandSlugs } }
      : { slug: cq.brandSlugs[0] };
  }

  const minPrice = cq.minPrice ? BigInt(cq.minPrice) : null;
  const maxPrice = cq.maxPrice ? BigInt(cq.maxPrice) : null;
  if (minPrice !== null || maxPrice !== null) {
    where.AND = where.AND ?? [];
    if (minPrice !== null) {
      where.AND.push({ OR: [
        { salePrice: { gte: minPrice } },
        { AND: [{ salePrice: null }, { price: { gte: minPrice } }] },
      ]});
    }
    if (maxPrice !== null) {
      where.AND.push({ OR: [
        { salePrice: { lte: maxPrice } },
        { AND: [{ salePrice: null }, { price: { lte: maxPrice } }] },
      ]});
    }
  }

  // ── ویژگی‌ها: داخل هر ویژگی OR، بین ویژگی‌ها AND ──
  const valueGroups: string[][] = [];
  const slugKeys = Object.keys(cq.attrFilters);

  if (slugKeys.length) {
    const attrs = await prisma.attribute.findMany({
      where: { slug: { in: slugKeys } },
      select: { slug: true, values: { select: { id: true, slug: true } } },
    });
    const bySlug = new Map<string, string[]>();
    for (const a of attrs) {
      const wanted = cq.attrFilters[a.slug] ?? [];
      const ids = a.values.filter(v => v.slug && wanted.includes(v.slug)).map(v => v.id);
      if (ids.length) bySlug.set(a.slug, [...(bySlug.get(a.slug) ?? []), ...ids]);
    }
    if (bySlug.size < slugKeys.length) return null; // fail-closed
    valueGroups.push(...bySlug.values());
  }

  if (legacyValueIds.length) {
    const vals = await prisma.attributeValue.findMany({
      where: { id: { in: legacyValueIds } },
      select: { id: true, attributeId: true },
    });
    const byAttr = new Map<string, string[]>();
    for (const v of vals) byAttr.set(v.attributeId, [...(byAttr.get(v.attributeId) ?? []), v.id]);
    valueGroups.push(...byAttr.values());
  }

  for (const ids of valueGroups) {
    where.AND = where.AND ?? [];
    where.AND.push({ attributes: { some: { attributeValueId: { in: ids } } } });
  }

  return where;
}

export function buildCatalogOrderBy(sort: SortType): any {
  if (sort === "price_asc")  return [{ salePrice: "asc" }, { price: "asc" }];
  if (sort === "price_desc") return [{ salePrice: "desc" }, { price: "desc" }];
  if (sort === "popular")    return { ratingCount: "desc" };
  return { createdAt: "desc" };
}

export const CATALOG_INCLUDE = {
  brand: { select: { title: true, slug: true, logoUrl: true } },
  category: { select: { title: true, slug: true } },
  images: { orderBy: { sortOrder: "asc" as const }, take: 1 },
};

export function mapCatalogProduct(p: any) {
  return {
    id: p.id, title: p.title, slug: p.slug,
    mainImage: p.mainImage, price: p.price, salePrice: p.salePrice,
    ratingAvg: p.ratingAvg, ratingCount: p.ratingCount,
    brand: p.brand, category: p.category,
    image: p.images[0]?.url ?? p.mainImage ?? null,
    stock: p.stock, trackStock: p.trackStock, lowStockThreshold: p.lowStockThreshold,
  };
}

/** اجرای کامل — هم SSR هم API از این استفاده می‌کنند */
export async function fetchCatalog(cq: CatalogQuery, legacyValueIds: string[] = []) {
  const where = await buildCatalogWhere(cq, legacyValueIds);
  if (!where) return { page: cq.page, pageSize: cq.pageSize, total: 0, items: [] };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: buildCatalogOrderBy(cq.sort),
      skip: (cq.page - 1) * cq.pageSize,
      take: cq.pageSize,
      include: CATALOG_INCLUDE,
    }),
    prisma.product.count({ where }),
  ]);

  return { page: cq.page, pageSize: cq.pageSize, total, items: items.map(mapCatalogProduct) };
}