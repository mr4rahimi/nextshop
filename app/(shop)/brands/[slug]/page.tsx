import { notFound } from "next/navigation";
import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import BrandPageClient from "@/components/store/brands/BrandPageClient";
import { SITE_URL, buildBaseMetadata, buildBreadcrumbSchema, buildItemListSchema, canonicalUrl } from "@/lib/seo";
import { serialize } from "@/lib/serialize";
import { fetchCatalog, analyzeListingParams, listingIndexPolicy } from "@/lib/catalog";

type SP = Record<string, string | string[] | undefined>;
interface Props { params: Promise<{ slug: string }>; searchParams: Promise<SP> }

const PAGE_SIZE = 12;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

async function getBrand(slug: string) {
  const res = await fetch(`${BASE_URL}/api/store/brands/${slug}`, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [brand, settings] = await Promise.all([
    getBrand(slug),
    prisma.storeSettings.findUnique({ where: { id: "singleton" }, select: { storeLogo: true, storeName: true } }),
  ]);
  if (!brand) return { title: "برند یافت نشد" };
  // همان سیاست ایندکس دسته و /products: صفحه‌بندی خودارجاع، فیلتر noindex
  const policy = listingIndexPolicy(`/brands/${slug}`, sp);
  const pageSuffix = "page" in policy && policy.page > 1 ? ` — صفحه ${policy.page}` : "";
  return buildBaseMetadata({
    title:       (brand.seoTitle       || `محصولات ${brand.title}`) + pageSuffix,
    description: brand.seoDescription || brand.description || `خرید محصولات اصل ${brand.title}`,
    image:       brand.logoUrl        || settings?.storeLogo || null,
    siteName:    settings?.storeName  || undefined,
    path:        policy.canonicalPath,
    canonicalPath: policy.canonicalPath,
    noIndex:     policy.kind === "filtered",
    followWhenNoIndex: true,
  });
}

export default async function BrandPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const brand = await getBrand(slug);
  if (!brand) notFound();

  // ── SSR صفحه‌ی جاری محصولات — فقط `page` از آدرس؛ فیلترها در کلاینت‌اند ──
  const { page } = analyzeListingParams(sp);
  const initialData = serialize(await fetchCatalog({
    brandSlugs: [slug], attrFilters: {}, conditions: [], sort: "newest", page, pageSize: PAGE_SIZE,
  }));
  // صفحه‌ای فراتر از آخرین صفحه محتوا ندارد — ۴۰۴، نه یک لیست خالی ایندکس‌پذیر
  if (page > 1 && initialData.items.length === 0) notFound();

  let breadcrumbJson = "";
  let itemListJson = "";
  try {
    const products = initialData.items as { title: string; slug: string; mainImage: string | null }[];
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
      <BrandPageClient brand={brand} brandSlug={slug} initialData={initialData} />
    </>
  );
}
