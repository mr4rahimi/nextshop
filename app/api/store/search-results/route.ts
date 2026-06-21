import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

// specValues format: "specItemId1__value1,specItemId2__value2"
// Multiple values for same specItem = OR within that item's group
// Different specItems = AND

export async function GET(req: Request) {
  const url = new URL(req.url);
  const categoryId = url.searchParams.get("categoryId");
  const brandId = url.searchParams.get("brandId");
  const specValuesRaw = url.searchParams.get("specValues") ?? "";
  const pageSize = Math.min(48, Math.max(1, Number(url.searchParams.get("pageSize") ?? "4")));
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));

  const where: any = { isActive: true };

  if (categoryId) {
    // include subcategories
    const cat = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, children: { select: { id: true } } },
    });
    if (cat) {
      where.categoryId = { in: [cat.id, ...cat.children.map((c) => c.id)] };
    }
  }

  if (brandId) where.brandId = brandId;

  // Parse spec values: group by specItemId, apply AND across different specItems
  if (specValuesRaw) {
    const pairs = specValuesRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const idx = s.indexOf("__");
        if (idx < 0) return null;
        return { specItemId: s.slice(0, idx), value: s.slice(idx + 2) };
      })
      .filter(Boolean) as { specItemId: string; value: string }[];

    // Group by specItemId → OR within same spec item, AND across different
    const byItem = new Map<string, string[]>();
    for (const p of pairs) {
      if (!byItem.has(p.specItemId)) byItem.set(p.specItemId, []);
      byItem.get(p.specItemId)!.push(p.value);
    }

    if (byItem.size > 0) {
      where.AND = where.AND ?? [];
      for (const [specItemId, values] of byItem) {
        where.AND.push({
          specs: {
            some: {
              specItemId,
              value: { in: values },
            },
          },
        });
      }
    }
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
