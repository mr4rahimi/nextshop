import { notFound } from "next/navigation";
import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import ProductDetailClient from "@/components/store/product/ProductDetailClient";
import {
  SITE_URL,
  canonicalUrl,
  buildBaseMetadata,
  buildProductSchema,
  buildBreadcrumbSchema,
  buildFAQSchema,
} from "@/lib/seo";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getProduct(slug: string) {
  try {
    const product = await prisma.product.findUnique({
      where: {
        slug,
        isActive: true,
      },
      include: {
        brand: {
          select: {
            title: true,
            slug: true,
          },
        },

        category: {
          select: {
            title: true,
            slug: true,
          },
        },

        images: {
          select: {
            url: true,
            id: true,
            alt: true,
            sortOrder: true,
          },
          take: 10,
        },

        specs: {
          include: {
            specItem: {
              include: {
                group: true,
              },
            },
          },
        },

        reviews: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc" as const,
          },
          take: 20,
        },

        relatedProducts: {
          include: {
            related: {
              select: {
                id: true,
                title: true,
                slug: true,
                mainImage: true,
                price: true,
                salePrice: true,
                stock: true,
                trackStock: true,

                category: {
                  select: {
                    title: true,
                    slug: true,
                  },
                },

                brand: {
                  select: {
                    title: true,
                  },
                },

                images: {
                  take: 1,
                  select: {
                    url: true,
                  },
                },
              },
            },
          },
          orderBy: {
            sortOrder: "asc" as const,
          },
        },
      },
    });

    if (!product) return null;

    // related products
    const relatedSettings = (product.relatedSettings ?? {}) as {
      categoryEnabled?: boolean;
      categorySort?: string;
      brandEnabled?: boolean;
      brandSort?: string;
    };

    let categoryRelated: any[] = [];
    let brandRelated: any[] = [];

    if (relatedSettings.categoryEnabled && product.categoryId) {
      categoryRelated = serialize(
        await prisma.product.findMany({
          where: {
            isActive: true,
            categoryId: product.categoryId,
            id: {
              not: product.id,
            },
          },

          orderBy:
            relatedSettings.categorySort === "popular"
              ? {
                  ratingCount: "desc",
                }
              : {
                  createdAt: "desc",
                },

          take: 6,

          select: {
            id: true,
            title: true,
            slug: true,
            mainImage: true,
            price: true,
            salePrice: true,
            stock: true,
            trackStock: true,

            category: {
              select: {
                title: true,
                slug: true,
              },
            },

            brand: {
              select: {
                title: true,
              },
            },
          },
        })
      );
    }

    if (relatedSettings.brandEnabled && product.brandId) {
      brandRelated = serialize(
        await prisma.product.findMany({
          where: {
            isActive: true,
            brandId: product.brandId,
            id: {
              not: product.id,
            },
          },

          orderBy:
            relatedSettings.brandSort === "popular"
              ? {
                  ratingCount: "desc",
                }
              : {
                  createdAt: "desc",
                },

          take: 6,

          select: {
            id: true,
            title: true,
            slug: true,
            mainImage: true,
            price: true,
            salePrice: true,
            stock: true,
            trackStock: true,

            category: {
              select: {
                title: true,
                slug: true,
              },
            },

            brand: {
              select: {
                title: true,
              },
            },
          },
        })
      );
    }

    const manualRelated = (
      product.relatedProducts ?? []
    ).map((r: any) => r.related);

    return {
      ...serialize(product),
      categoryRelated,
      brandRelated,
      manualRelated,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { slug } = await params;

  const p = await getProduct(slug);

  if (!p) {
    return {
      title: "محصول یافت نشد",
    };
  }

  const img =
    p.mainImage ??
    p.images?.[0]?.url ??
    null;

  return {
    ...buildBaseMetadata({
      title:
        p.seoTitle ||
        `خرید ${p.title}`,

      description:
        p.seoDescription ||
        p.shortDescription ||
        `خرید ${p.title} با بهترین قیمت`,

      keywords:
        p.seoKeywords || undefined,

      image: img,

      path: `/products/${slug}`,
    }),
  };
}

export default async function ProductDetailPage({
  params,
}: Props) {
  const { slug } = await params;

  const product = await getProduct(slug);

  if (!product) {
    notFound();
  }

  // Schema.org
  const productUrl = canonicalUrl(
    `/products/${slug}`
  );

  const images = [
    product.mainImage,
    ...(product.images?.map(
      (i: any) => i.url
    ) ?? []),
  ].filter(Boolean);

  const faqItems = Array.isArray(
    product.faq
  )
    ? product.faq
        .map((f: any) => ({
          question:
            f.q ??
            f.question ??
            "",

          answer:
            f.a ??
            f.answer ??
            "",
        }))
        .filter(
          (f: any) =>
            f.question &&
            f.answer
        )
    : [];

  const productSchema =
    buildProductSchema({
      name: product.title,

      description:
        product.shortDescription ??
        product.seoDescription,

      image:
        product.mainImage,

      images,

      sku: product.sku,

      brand:
        product.brand?.title,

      price:
        product.price,

      salePrice:
        product.salePrice,

      inStock:
        product.isActive &&
        product.stock !== 0,

      url: productUrl,

      ratingValue:
        product.ratingAvg,

      ratingCount:
        product.ratingCount,

      category:
        product.category?.title,
    });

  const breadcrumbSchema =
    buildBreadcrumbSchema([
      {
        name: "خانه",
        url: SITE_URL,
      },

      {
        name: "فروشگاه",
        url: `${SITE_URL}/products`,
      },

      ...(product.category
        ? [
            {
              name:
                product.category
                  .title,

              url: `${SITE_URL}/categories/${product.category.slug}`,
            },
          ]
        : []),

      {
        name: product.title,
        url: productUrl,
      },
    ]);

  const faqSchema =
    buildFAQSchema(faqItems);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            productSchema
          ),
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbSchema
          ),
        }}
      />

      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              faqSchema
            ),
          }}
        />
      )}

      <ProductDetailClient
        product={product}
        categoryRelated={
          product.categoryRelated
        }
        brandRelated={
          product.brandRelated
        }
        manualRelated={
          product.manualRelated
        }
      />
    </>
  );
}