import { notFound } from "next/navigation";
import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import CategoryPageClient from "@/components/store/categories/CategoryPageClient";
import { SITE_URL, buildBaseMetadata, buildBreadcrumbSchema, buildItemListSchema, canonicalUrl } from "@/lib/seo";

interface Props { params: Promise<{ slug: string }> }

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

async function getCategory(slug: string) {
  const res = await fetch(`${BASE_URL}/api/store/categories/${slug}`, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [category, settings] = await Promise.all([
    getCategory(slug),
    prisma.storeSettings.findUnique({ where: { id: "singleton" }, select: { storeLogo: true, storeName: true } }),
  ]);
  if (!category) return { title: "دسته‌بندی یافت نشد" };
  const storeName = settings?.storeName ?? "فروشگاه";
  return buildBaseMetadata({
    title:       category.seoTitle       || `خرید ${category.title}`,
    description: category.seoDescription || category.description || `بهترین محصولات در دسته ${category.title}`,
    image:       category.imageUrl       || settings?.storeLogo || null,
    siteName:    settings?.storeName     || undefined,
    path:        `/categories/${slug}`,
  });
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();

  let breadcrumbJson = "";
  let itemListJson = "";
  try {
    const products = await prisma.product.findMany({
      where: { categoryId: category.id, isActive: true },
      take: 8, select: { title: true, slug: true, mainImage: true },
    });
    breadcrumbJson = JSON.stringify(buildBreadcrumbSchema([
      { name: "خانه", url: SITE_URL },
      ...(category.parent ? [{ name: category.parent.title, url: `${SITE_URL}/categories/${category.parent.slug}` }] : []),
      { name: category.title, url: canonicalUrl(`/categories/${slug}`) },
    ]));
    itemListJson = JSON.stringify(buildItemListSchema({
      name: category.title, url: canonicalUrl(`/categories/${slug}`),
      items: products.map((p: any, i: number) => ({ position: i + 1, name: p.title, url: `${SITE_URL}/products/${p.slug}`, image: p.mainImage })),
    }));
  } catch {}

  return (
    <>
      {breadcrumbJson && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJson }} />}
      {itemListJson   && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemListJson }} />}
      <CategoryPageClient category={category} categorySlug={slug} />
    </>
  );
}
