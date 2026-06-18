import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\u200c/g, "")
    .replace(/\s+/g, "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[أإآ]/g, "ا")
    .trim();
}

function normSql(col: string): string {
  return `translate(
            replace(replace(lower(${col}), ' ', ''), chr(8204), ''),
            'يكأإآ', 'یکااا'
          )`;
}

export async function GET(req: Request) {
  const url   = new URL(req.url);
  const qRaw  = url.searchParams.get("q")?.trim() ?? "";
  const page  = parseInt(url.searchParams.get("page") ?? "1");
  const limit = parseInt(url.searchParams.get("limit") ?? "6");

  if (!qRaw || qRaw.length < 2) {
    return NextResponse.json({ products: [], total: 0, suggestions: { categories: [], brands: [] } });
  }

  const qn = normalize(qRaw);
  const pattern = `%${qn}%`;
  const offset = (page - 1) * limit;

  const whereClause = `
    p."isActive" = true
    AND (
      ${normSql("p.title")} LIKE $1
      OR ${normSql(`COALESCE(b.title,'')`)} LIKE $1
      OR ${normSql(`COALESCE(c.title,'')`)} LIKE $1
    )`;

  const productsRaw = await prisma.$queryRawUnsafe<any[]>(`
    SELECT p.id, p.title, p.slug, p.price, p."salePrice", p."mainImage",
           p.stock, p."trackStock", p."lowStockThreshold",
           b.title AS brand_title,
           c.title AS category_title, c.slug AS category_slug
    FROM "Product" p
    LEFT JOIN "Brand" b ON b.id = p."brandId"
    LEFT JOIN "Category" c ON c.id = p."categoryId"
    WHERE ${whereClause}
    ORDER BY p."createdAt" DESC
    LIMIT ${limit} OFFSET ${offset}
  `, pattern);

  const countRaw = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*)::int AS count
    FROM "Product" p
    LEFT JOIN "Brand" b ON b.id = p."brandId"
    LEFT JOIN "Category" c ON c.id = p."categoryId"
    WHERE ${whereClause}
  `, pattern);

  const total = countRaw[0]?.count ?? 0;

  const products = productsRaw.map(p => ({
    id: p.id, title: p.title, slug: p.slug,
    price: p.price, salePrice: p.salePrice,
    mainImage: p.mainImage,
    stock: p.stock, trackStock: p.trackStock, lowStockThreshold: p.lowStockThreshold,
    images: [] as { url: string }[],
    brand: p.brand_title ? { title: p.brand_title } : null,
    category: p.category_title ? { title: p.category_title, slug: p.category_slug } : null,
  }));

  const catsRaw = await prisma.$queryRawUnsafe<any[]>(`
    SELECT title, slug, "imageUrl"
    FROM "Category"
    WHERE "isActive" = true AND ${normSql("title")} LIKE $1
    LIMIT 3
  `, pattern);

  const brandsRaw = await prisma.$queryRawUnsafe<any[]>(`
    SELECT title, slug, "logoUrl"
    FROM "Brand"
    WHERE "isActive" = true AND ${normSql("title")} LIKE $1
    LIMIT 2
  `, pattern);

  return NextResponse.json(serialize({
    products, total,
    suggestions: {
      categories: catsRaw.map(c => ({ title: c.title, slug: c.slug, imageUrl: c.imageUrl })),
      brands: brandsRaw.map(b => ({ title: b.title, slug: b.slug, logoUrl: b.logoUrl })),
    },
  }));
}
