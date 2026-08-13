import { notFound } from "next/navigation";
import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import ProductDetailClient from "@/components/store/product/ProductDetailClient";
import {
  SITE_URL,
  canonicalUrl,
  encodeSlug,
  externalImageOrigins,
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

  const img = p.mainImage ?? p.images?.[0]?.url ?? null;

  
  const absoluteImg = img
    ? img.startsWith("http")
      ? img
      : `${SITE_URL}${img.startsWith("/") ? img : `/${img}`}`
    : undefined;


  const priceNum = Number(p.price);
  const salePriceNum = p.salePrice ? Number(p.salePrice) : null;
  const effectivePrice =
    salePriceNum && salePriceNum < priceNum ? salePriceNum : priceNum;


  const inStock = p.isActive && p.stock !== 0;

  const base = buildBaseMetadata({
    title: p.seoTitle || `خرید ${p.title}`,
    description: buildProductDescription({
      base:
        p.seoDescription ||
        p.shortDescription ||
        `خرید ${p.title} با بهترین قیمت`,
      price: effectivePrice,
      inStock,
    }),
    keywords: p.seoKeywords || undefined,
    image: absoluteImg,
    path: `/products/${slug}`,
    ogType: "product",
  });

  return {
    ...base,
    other: {
      product_price: String(effectivePrice),
      availability: inStock ? "instock" : "outofstock",
      product_name: p.title,
      product_id: p.id,
      ...(p.warranty ? { guarantee: p.warranty } : {}),
    },
  };
}

/**
 * `seoSchema` در ادمین به‌صورت متن آزاد وارد می‌شود، پس ممکن است JSON نامعتبر
 * باشد. اگر parse نشد نادیده گرفته می‌شود تا صفحه نشکند.
 */
function parseCustomSchema(raw?: string | null) {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

const META_DESCRIPTION_MAX = 155;

/**
 * قیمت و یک CTA کوتاه را به توضیحات متا اضافه می‌کند، ولی فقط اگر بعد از
 * افزودن هنوز زیر سقف ۱۵۵ کاراکتر باشیم — وگرنه متن پایه دست‌نخورده می‌ماند.
 */
function buildProductDescription(opts: {
  base: string;
  price: number;
  inStock: boolean;
}) {
  const base = opts.base.trim();
  if (!opts.inStock || opts.price <= 0) return base;

  const suffix = ` قیمت ${opts.price.toLocaleString("fa-IR")} تومان — همین حالا سفارش دهید.`;
  return base.length + suffix.length <= META_DESCRIPTION_MAX
    ? base + suffix
    : base;
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
    `/products/${encodeSlug(slug)}`
  );

  // JSON-LD سفارشی که در ادمین روی محصول ذخیره شده
  const customSchema = parseCustomSchema(
    product.seoSchema
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

      gtin13: product.gtin13,

      mpn: product.mpn,

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

              url: `${SITE_URL}/categories/${encodeSlug(product.category.slug)}`,
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
      {/* تصاویر محصول معمولاً روی دامنه‌ی دیگری میزبانی می‌شوند؛ گرم کردن زودهنگام
          اتصال، DNS و TLS را از مسیر بحرانی LCP خارج می‌کند */}
      {externalImageOrigins(images).map((origin) => (
        <link key={origin} rel="preconnect" href={origin} crossOrigin="" />
      ))}

      {/* buildBaseMetadata عمداً og:type را ست نمی‌کند (Next مقدار product را
          رد می‌کند)، پس اینجا مستقیم ساخته می‌شود و React به head منتقلش می‌کند */}
      <meta property="og:type" content="product" />

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

      {customSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              customSchema
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