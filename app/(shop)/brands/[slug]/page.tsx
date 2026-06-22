import { notFound } from "next/navigation";
import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import BrandPageClient from "@/components/store/brands/BrandPageClient";
import { SITE_URL, buildBaseMetadata, buildBreadcrumbSchema, buildItemListSchema, canonicalUrl } from "@/lib/seo";

interface Props { params: Promise<{ slug: string }> }

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

async function getBrand(slug: string) {
  const res = await fetch(`${BASE_URL}/api/store/brands/${slug}`, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [brand, settings] = await Promise.all([
    getBrand(slug),
    prisma.storeSettings.findUnique({ where: { id: "singleton" }, select: { storeLogo: true, storeName: true } }),
  ]);
  if (!brand) return { title: "برند یافت نشد" };
  const storeName = settings?.storeName ?? "فروشگاه";
  return buildBaseMetadata({
    title:       brand.seoTitle       || `محصولات ${brand.title}`,
    description: brand.seoDescription || brand.description || `خرید محصولات اصل ${brand.title}`,
    image:       brand.logoUrl        || settings?.storeLogo || null,
    siteName:    settings?.storeName  || undefined,
    path:        `/brands/${slug}`,
  });
}

export default async function BrandPage({ params }: Props) {
  const { slug } = await params;
  const brand = await getBrand(slug);
  if (!brand) notFound();

  let breadcrumbJson = "";
  let itemListJson = "";
  try {
    const products = await prisma.product.findMany({
      where: { brandId: brand.id, isActive: true },
      take: 8, select: { title: true, slug: true, mainImage: true },
    });
    breadcrumbJson = JSON.stringify(buildBreadcrumbSchema([
      { name: "خانه",    url: SITE_URL },
      { name: "برندها",  url: `${SITE_URL}/brands` },
      { name: brand.title, url: canonicalUrl(`/brands/${slug}`) },
    ]));
    itemListJson = JSON.stringify(buildItemListSchema({
      name: brand.title, url: canonicalUrl(`/brands/${slug}`),
      items: products.map((p: any, i: number) => ({ position: i + 1, name: p.title, url: `${SITE_URL}/products/${p.slug}`, image: p.mainImage })),
    }));
  } catch {}

  return (
    <>
      {breadcrumbJson && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJson }} />}
      {itemListJson   && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemListJson }} />}
      <BrandPageClient brand={brand} brandSlug={slug} />
    </>
  );
}
