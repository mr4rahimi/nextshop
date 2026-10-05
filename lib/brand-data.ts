import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

/**
 * داده‌ی صفحه‌ی برند — مستقیم از Prisma، هم برای صفحه و هم `/api/store/brands/[slug]`.
 *
 * صفحه قبلاً با HTTP به API خودش می‌زد و آدرس را از `NEXT_PUBLIC_BASE_URL` یا
 * `localhost:3000` می‌ساخت؛ سایتی که روی پورت دیگری است و آن env را ندارد
 * صفحه‌ی برندش همیشه ۴۰۴ بود (همان تله‌ی ۴ در docs/guide/project-guide.md).
 */
export async function getBrandData(slug: string) {
  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand || !brand.isActive) return null;

  const [priceAgg, categories] = await Promise.all([
    prisma.product.aggregate({
      where: { isActive: true, brand: { slug } },
      _min: { price: true },
      _max: { price: true },
    }),
    prisma.category.findMany({
      where: {
        isActive: true,
        products: { some: { isActive: true, brand: { slug } } },
      },
      select: { id: true, title: true, slug: true, imageUrl: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return serialize({
    id: brand.id,
    title: brand.title,
    slug: brand.slug,
    description: brand.description,
    logoUrl: brand.logoUrl,
    seoTitle: brand.seoTitle,
    seoDescription: brand.seoDescription,
    categories,
    priceRange: {
      min: priceAgg._min.price ?? 0,
      max: priceAgg._max.price ?? 100_000_000,
    },
  });
}
