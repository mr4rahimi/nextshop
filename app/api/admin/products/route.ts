import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { NextResponse } from "next/server";
 
// ─── GET /api/admin/products ──────────────────────────────────────────────────
export const runtime = "nodejs";

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const pageParam     = url.searchParams.get("page");
  const pageSizeParam = url.searchParams.get("pageSize");
  const search   = url.searchParams.get("search")?.trim() || url.searchParams.get("q")?.trim();
  const category = url.searchParams.get("category")?.trim();
  const brand     = url.searchParams.get("brand")?.trim();
  const status    = url.searchParams.get("status")?.trim();
  const attrValues = url.searchParams.getAll("attr").filter(Boolean);

  const page     = Math.max(1, toInt(pageParam, 1));
  const pageSize = Math.min(5000, Math.max(1, toInt(pageSizeParam, 50)));

  const where: any = {};

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { slug:  { contains: search, mode: "insensitive" } },
      { category: { title: { contains: search, mode: "insensitive" } } },
      { brand:    { title: { contains: search, mode: "insensitive" } } },
    ];
  }

  if (category) where.category = { title: category };
  if (brand)     where.brand    = { title: brand };

  if (status === "active")   where.isActive = true;
  if (status === "inactive") where.isActive = false;
  if (status === "outofstock") {
    where.trackStock = true;
    where.stock = 0;
  }

  if (attrValues.length > 0) {
    where.attributes = { some: { attributeValueId: { in: attrValues } } };
  }

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        slug: true,
        price: true,
        salePrice: true,
        mainImage: true,
        isActive: true,
        stock: true,
        trackStock: true,
        lowStockThreshold: true,
        createdAt: true,
        category: { select: { title: true } },
        brand: { select: { title: true } },
        attributes: { select: { attributeValueId: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return NextResponse.json(serialize({ items, total, page, pageSize }));
}
// ─── POST /api/admin/products ─────────────────────────────────────────────────
export async function POST(req: Request) {
  const body = await req.json();
 
  const product = await prisma.product.create({
    data: {
      title:             body.title,
      slug:              body.slug,
      categoryId:        body.categoryId,
      brandId:           body.brandId || null,
 
      shortDescription:  body.shortDescription,
      expertTitle:       body.expertTitle,
      expertDescription: body.expertDescription,
      expertImage:       body.expertImage,
 
      summaryTitle:       body.summaryTitle,
      summaryDescription: body.summaryDescription,
      summaryImage:       body.summaryImage,
      summaryFeatures:    body.summaryFeatures || [],
 
      videoUrl:  body.videoUrl,
      relatedSettings: body.relatedSettings || {},
      mainImage: body.mainImage,
 
      features: body.features || [],
      colors:   body.colors   || [],
 
      price:     BigInt(body.price || 0),
      salePrice: body.salePrice ? BigInt(body.salePrice) : null,
 
      warranty: body.warranty,
      stock:      body.stock      ? parseInt(body.stock) : 0,
      trackStock: body.trackStock ?? false,
      lowStockThreshold: body.lowStockThreshold ? parseInt(body.lowStockThreshold) : 3,
      faq:      body.faq || [],
 
      isActive: body.isActive ?? true,
 
      seoTitle:       body.seoTitle,
      seoDescription: body.seoDescription,
      seoKeywords:    body.seoKeywords,
      seoSchema:      body.seoSchema,
 
      images: {
        create: (body.images || []).map((url: string, index: number) => ({
          url,
          sortOrder: index,
        })),
      },
 
      specs: {
        create: (body.specs || []).map((s: any) => ({
          specItemId: s.specItemId,
          value:      s.value,
        })),
      },
    },
    include: {
      images: true,
      specs:  { include: { specItem: true } },
    },
  });
 
  return NextResponse.json(serialize(product));
}
 