import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { id } = await req.json();

  const original = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      specs:  true,
    },
  });

  if (!original) return NextResponse.json({ error: "محصول یافت نشد" }, { status: 404 });

  const baseSlug = `${original.slug}-copy`;
  let slug = baseSlug;
  let counter = 1;
  while (await prisma.product.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter++}`;
  }

  const copy = await prisma.product.create({
    data: {
      title:              `${original.title} (کپی)`,
      slug,
      categoryId:         original.categoryId,
      brandId:            original.brandId,
      shortDescription:   original.shortDescription,
      expertTitle:        original.expertTitle,
      expertDescription:  original.expertDescription,
      expertImage:        original.expertImage,
      summaryTitle:       original.summaryTitle,
      summaryDescription: original.summaryDescription,
      summaryImage:       original.summaryImage,
      summaryFeatures:    original.summaryFeatures ?? [],
      videoUrl:           original.videoUrl,
      mainImage:          original.mainImage,
      features:           original.features ?? [],
      colors:             original.colors ?? [],
      price:              original.price,
      salePrice:          original.salePrice,
      warranty:           original.warranty,
      stock:              original.stock,
      trackStock:         original.trackStock,
      lowStockThreshold:  original.lowStockThreshold,
      faq:                original.faq ?? [],
      seoTitle:           original.seoTitle,
      seoDescription:     original.seoDescription,
      seoKeywords:        original.seoKeywords,
      seoSchema:          original.seoSchema,
      relatedSettings:    original.relatedSettings ?? {},
      isActive:           false,
      images: {
        create: original.images.map(img => ({
          url: img.url,
          alt: img.alt,
          sortOrder: img.sortOrder,
        })),
      },
      specs: {
        create: original.specs.map(s => ({
          specItemId: s.specItemId,
          value: s.value,
        })),
      },
    },
  });

  return NextResponse.json(serialize({ id: copy.id }));
}
