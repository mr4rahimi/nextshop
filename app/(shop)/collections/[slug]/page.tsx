import { notFound } from "next/navigation";
import { Metadata } from "next";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import CategoryPageClient from "@/components/store/categories/CategoryPageClient";
import { SITE_URL, buildBaseMetadata, buildBreadcrumbSchema, buildItemListSchema, canonicalUrl } from "@/lib/seo";
import { parseCatalogQuery, fetchCatalog } from "@/lib/catalog";
import { getLandingBySlug } from "@/lib/landing-pages";
import { getCategoryData } from "@/lib/category-data";

const PAGE_SIZE = 12;
type SP = Record<string, string | string[] | undefined>;
interface Props { params: Promise<{ slug: string }>; searchParams: Promise<SP> }

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const lp = await getLandingBySlug(slug);
  if (!lp) return { title: "یافت نشد", robots: { index: false, follow: false } };

  const settings = await prisma.storeSettings.findUnique({
    where: { id: "singleton" }, select: { storeLogo: true, storeName: true },
  });

  const one = (k: string) => { const v = sp[k]; return Array.isArray(v) ? v[0] : v; };
  const pageNum = parseInt(one("page") ?? "1");
  const page = Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1;
  const extra = !!one("sort") || !!one("minPrice") || !!one("maxPrice");

  return buildBaseMetadata({
    title: lp.title + (page > 1 ? ` — صفحه ${page}` : ""),
    description: lp.description,
    image: settings?.storeLogo || null,
    siteName: settings?.storeName || undefined,
    path: `/collections/${slug}${page > 1 ? `?page=${page}` : ""}`,
    canonicalPath: extra ? `/collections/${slug}` : undefined,
    noIndex: !lp.isIndexable || extra,
    followWhenNoIndex: true,
  });
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const lp = await getLandingBySlug(slug);
  if (!lp) notFound();

  const category = await getCategoryData(lp.categorySlug);
  if (!category) notFound();

  // فیلترهای صفحه فرود همیشه اعمال می‌شوند؛ کاربر فقط sort/price/page را تغییر می‌دهد
  const cq = parseCatalogQuery({ ...sp, ...lp.filters, category: lp.categorySlug }, { pageSize: PAGE_SIZE });
  cq.categorySlug = lp.categorySlug;
  const initialData = serialize(await fetchCatalog(cq));

  const breadcrumbJson = JSON.stringify(buildBreadcrumbSchema([
    { name: "خانه", url: SITE_URL },
    { name: category.title, url: canonicalUrl(`/categories/${lp.categorySlug}`) },
    { name: lp.h1, url: canonicalUrl(`/collections/${slug}`) },
  ]));

  const itemListJson = JSON.stringify(buildItemListSchema({
    name: lp.h1,
    url: canonicalUrl(`/collections/${slug}`),
    items: initialData.items.slice(0, 12).map((p: any, i: number) => ({
      position: i + 1, name: p.title, url: `${SITE_URL}/products/${p.slug}`, image: p.mainImage,
    })),
  }));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJson }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemListJson }} />
      <Suspense fallback={null}>
        <CategoryPageClient
          category={category}
          categorySlug={lp.categorySlug}
          initialData={initialData}
          landingH1={lp.h1}
          landingIntro={lp.intro}
          lockedFilters={lp.filters}
          basePath={`/collections/${slug}`}
        />
      </Suspense>
    </>
  );
}