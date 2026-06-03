import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { NextResponse } from "next/server";

// ─── GET /api/admin/products/[id] ────────────────────────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      specs: { include: { specItem: true } },
      category: true,
      brand: true,
    },
  });

  if (!product) {
    return NextResponse.json({ error: "محصول یافت نشد" }, { status: 404 });
  }

  return NextResponse.json(serialize(product));
}

// ─── PUT /api/admin/products/[id] ────────────────────────────────────────────
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  await prisma.productImage.deleteMany({ where: { productId: id } });
  await prisma.productSpecValue.deleteMany({ where: { productId: id } });

  const updated = await prisma.product.update({
    where: { id },
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
      specs: { include: { specItem: true } },
    },
  });

  return NextResponse.json(serialize(updated));
}

// ─── DELETE /api/admin/products/[id] ─────────────────────────────────────────
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ success: true });
}