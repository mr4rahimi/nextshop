import { notFound, redirect } from "next/navigation";
import { Metadata } from "next";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import CategoryPageClient from "@/components/store/categories/CategoryPageClient";
import { SITE_URL, buildBaseMetadata, buildBreadcrumbSchema, buildItemListSchema, buildFAQSchema, canonicalUrl, externalImageOrigins } from "@/lib/seo";
import { normalizeFaq } from "@/lib/faq";
import { parseCatalogQuery, fetchCatalog, RESERVED_PARAMS, listingIndexPolicy } from "@/lib/catalog";
import { matchLandingByFilters } from "@/lib/landing-pages";
import { getCategoryData as getCategory } from "@/lib/category-data";

const PAGE_SIZE = 12;

type SP = Record<string, string | string[] | undefined>;
interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SP>;
}


// ── تحلیل فیلترهای فعال ──
function analyzeFilters(sp: SP) {
  const one = (k: string) => { const v = sp[k]; return Array.isArray(v) ? v[0] : v; };

  const activeFilters: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (k.startsWith("utm_")) continue;
    const val = Array.isArray(v) ? v[0] : v;
    if (!val) continue;
    if (k === "brand" || !RESERVED_PARAMS.has(k)) activeFilters[k] = val;
  }

  const pageNum = parseInt(one("page") ?? "1");
  return {
    activeFilters,
    hasFilters: Object.keys(activeFilters).length > 0,
    hasSort: !!one("sort") && one("sort") !== "newest",
    hasPrice: !!one("minPrice") || !!one("maxPrice"),
    page: Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1,
  };
}

/** بازسازی query string به‌صورت مرتب — برای canonical پایدار */
function stableQs(filters: Record<string, string>, page: number) {
  const p = new URLSearchParams();
  Object.keys(filters).sort().forEach(k => p.set(k, filters[k]));
  if (page > 1) p.set("page", String(page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [category, settings] = await Promise.all([
    getCategory(slug),
    prisma.storeSettings.findUnique({ where: { id: "singleton" }, select: { storeLogo: true, storeName: true } }),
  ]);
  if (!category) return { title: "دسته‌بندی یافت نشد", robots: { index: false, follow: false } };

  const { activeFilters, hasFilters, hasSort, hasPrice, page } = analyzeFilters(sp);
  const landing = hasSort || hasPrice ? null : await matchLandingByFilters(slug, activeFilters);

  const basePath = `/categories/${slug}`;
  const pageSuffix = page > 1 ? ` — صفحه ${page}` : "";



  // ── سیاست ایندکس مشترک با /products (lib/catalog.ts) ──
  const policy = listingIndexPolicy(basePath, sp);

  return buildBaseMetadata({
    title:       (category.seoTitle || `خرید ${category.title}`) + pageSuffix,
    description: category.seoDescription || category.description || `بهترین محصولات در دسته ${category.title}`,
    image:       category.imageUrl || settings?.storeLogo || null,
    siteName:    settings?.storeName || undefined,
    path:        policy.canonicalPath,
    canonicalPath: policy.canonicalPath,
    noIndex:     policy.kind === "filtered",
    followWhenNoIndex: true,
  });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const category = await getCategory(slug);
  if (!category) notFound();

  const { activeFilters, hasFilters, hasSort, hasPrice, page } = analyzeFilters(sp);
  const landing = hasSort || hasPrice ? null : await matchLandingByFilters(slug, activeFilters);
  // ترکیب فیلتر منطبق با یک صفحه فرود → ریدایرکت دائم به نسخه canonical
  if (landing) redirect(`/collections/${landing.slug}`);

  // ── SSR نتایج فیلترشده ──
  const cq = parseCatalogQuery(sp, { pageSize: PAGE_SIZE });
  cq.categorySlug = slug;
  const initialData = serialize(await fetchCatalog(cq));

  const h1 = category.title;

  /**
   * سوالات متداول فقط روی نسخه‌ی بدون فیلتر و صفحه‌ی اول منتشر می‌شود.
   * صفحه‌ی `?brand=hp&page=3` همان FAQ را دارد ولی canonical نیست؛ تکرار
   * `FAQPage` روی ده‌ها آدرس، از نظر گوگل اسپم اسکیماست.
   */
  const faqItems = hasFilters || hasSort || hasPrice || page > 1
    ? []
    : normalizeFaq((category as any).faq);

  let breadcrumbJson = "";
  let itemListJson = "";
  let faqJson = "";
  try {
    breadcrumbJson = JSON.stringify(buildBreadcrumbSchema([
      { name: "خانه", url: SITE_URL },
      ...(category.parent ? [{ name: category.parent.title, url: `${SITE_URL}/categories/${category.parent.slug}` }] : []),
      { name: h1, url: canonicalUrl(`/categories/${slug}`) },
    ]));
    itemListJson = JSON.stringify(buildItemListSchema({
      name: h1,
      url: canonicalUrl(`/categories/${slug}`),
      items: initialData.items.slice(0, 12).map((p: any, i: number) => ({
        position: i + 1, name: p.title, url: `${SITE_URL}/products/${p.slug}`, image: p.mainImage,
      })),
    }));
    const faqSchema = buildFAQSchema(faqItems);
    if (faqSchema) faqJson = JSON.stringify(faqSchema);
  } catch {}

  // تصاویر کارت‌های محصول روی دامنه‌ی خارجی‌اند و برخلاف صفحه محصول preload
  // نمی‌شوند؛ preconnect اتصال را قبل از پارس شدن کارت‌ها گرم می‌کند.
  const imageOrigins = externalImageOrigins(
    (initialData?.items ?? []).slice(0, 12).map((p: any) => p.mainImage)
  );

  return (
    <>
      {imageOrigins.map(origin => (
        <link key={origin} rel="preconnect" href={origin} crossOrigin="" />
      ))}
      {breadcrumbJson && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJson }} />}
      {itemListJson   && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemListJson }} />}
      {faqJson        && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJson }} />}
      <Suspense fallback={null}>
        <CategoryPageClient
          category={category}
          categorySlug={slug}
          initialData={initialData}
          landingH1={null}
          landingIntro={null}
        />
      </Suspense>
    </>
  );
}