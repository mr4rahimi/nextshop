import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;

  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    include: {
      brand: true,
      category: true,
      images: { orderBy: { sortOrder: "asc" } },
      specs: {
        include: {
          specItem: {
            include: { group: true },
          },
        },
      },
      reviews: {
        where: { isApproved: true },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!product) {
    return NextResponse.json({ message: "محصول یافت نشد" }, { status: 404 });
  }

  return NextResponse.json(
    serialize({
      id: product.id,
      title: product.title,
      slug: product.slug,
      shortDescription: product.shortDescription,
      mainImage: product.mainImage,
      videoUrl: product.videoUrl,
      features: product.features,
      colors: product.colors,
      warranty: product.warranty,
      stock: product.stock,
      trackStock: product.trackStock,
      lowStockThreshold: product.lowStockThreshold,
      price: product.price,
      salePrice: product.salePrice,
      ratingAvg: product.ratingAvg,
      ratingCount: product.ratingCount,
      isActive: product.isActive,
      // Summary section
      summaryTitle: product.summaryTitle,
      summaryDescription: product.summaryDescription,
      summaryImage: product.summaryImage,
      summaryFeatures: product.summaryFeatures,
      // Expert section
      expertTitle: product.expertTitle,
      expertDescription: product.expertDescription,
      expertImage: product.expertImage,
      // Download
      downloadTitle: product.downloadTitle,
      downloadUrl: product.downloadUrl,
      // FAQ
      faq: product.faq,
      // SEO
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      seoKeywords: product.seoKeywords,
      seoSchema: product.seoSchema,
      // Relations
      brand: product.brand,
      category: product.category,
      images: product.images,
      specs: product.specs.map((s) => ({
        id: s.id,
        value: s.value,
        specItem: {
          id: s.specItem.id,
          title: s.specItem.title,
          group: {
            id: s.specItem.group.id,
            title: s.specItem.group.title,
          },
        },
      })),
      reviews: product.reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        createdAt: r.createdAt,
        user: r.user,
      })),
    })
  );
}