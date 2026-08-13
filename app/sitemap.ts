import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_URL, encodeSlug } from "@/lib/seo";
import { listIndexableLandings } from "@/lib/landing-pages";
import { parseCatalogQuery, buildCatalogWhere } from "@/lib/catalog";

// force-dynamic: SITE_URL must come from the running process env, not build-time static output.
// Each of the 4 deployments has a different SITE_URL in its ecosystem.config.js.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  try {
    const [products, categories, brands, posts] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 45000,
      }),
      prisma.category.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
      }),
      prisma.brand.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
      }),
      prisma.blogPost.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true, publishedAt: true },
        orderBy: { publishedAt: "desc" },
      }),
    ]);

    // ── صفحات فرود: فقط آن‌هایی که واقعاً محصول دارند ──
    const landings = await listIndexableLandings();
    const landingEntries: MetadataRoute.Sitemap = [];

    for (const lp of landings) {
      const cq = parseCatalogQuery(
        { ...lp.filters, category: lp.categorySlug },
        { pageSize: 1 }
      );
      const where = await buildCatalogWhere(cq);
      if (!where) continue;
      const count = await prisma.product.count({ where });
      if (count === 0) continue;   // صفحه نازک وارد sitemap نمی‌شود

      landingEntries.push({
        url: `${SITE_URL}/collections/${encodeSlug(lp.slug)}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.75,
      });
    }

    // اسلاگ‌ها percent-encode می‌شوند: طبق استاندارد sitemap مقدار <loc> باید
    // URL معتبر باشد و اسلاگ‌های فارسی (مثل «شیرالات-دوم») بدون encode توسط
    // گوگل رد می‌شوند.
    const productUrls: MetadataRoute.Sitemap = products.map(p => ({
      url:             `${SITE_URL}/products/${encodeSlug(p.slug)}`,
      lastModified:    p.updatedAt,
      changeFrequency: "weekly",
      priority:        0.8,
    }));

    const categoryUrls: MetadataRoute.Sitemap = categories.map(c => ({
      url:             `${SITE_URL}/categories/${encodeSlug(c.slug)}`,
      lastModified:    c.updatedAt,
      changeFrequency: "weekly",
      priority:        0.7,
    }));

    const brandUrls: MetadataRoute.Sitemap = brands.map(b => ({
      url:             `${SITE_URL}/brands/${encodeSlug(b.slug)}`,
      lastModified:    b.updatedAt,
      changeFrequency: "weekly",
      priority:        0.6,
    }));

    const postUrls: MetadataRoute.Sitemap = posts.map(p => ({
      url:             `${SITE_URL}/mag/${encodeSlug(p.slug)}`,
      lastModified:    p.updatedAt,
      changeFrequency: "monthly",
      priority:        0.7,
    }));

    /**
     * `lastModified` صفحات لیستی از جدیدترین محتوای همان لیست می‌آید، نه از
     * `now`. اگر همیشه «الان» باشد، به گوگل می‌گوییم صفحه هر بار عوض شده و
     * سیگنال کاملاً بی‌ارزش می‌شود.
     */
    const newest = (rows: { updatedAt: Date }[]) =>
      rows.reduce<Date | null>(
        (max, r) => (!max || r.updatedAt > max ? r.updatedAt : max),
        null
      ) ?? now;

    const newestProduct  = newest(products);
    const newestCategory = newest(categories);
    const newestBrand    = newest(brands);
    const newestPost     = newest(posts);

    const staticPages: MetadataRoute.Sitemap = [
      { url: SITE_URL,                 lastModified: newestProduct,  changeFrequency: "daily",  priority: 1.0 },
      { url: `${SITE_URL}/products`,   lastModified: newestProduct,  changeFrequency: "daily",  priority: 0.9 },
      { url: `${SITE_URL}/categories`, lastModified: newestCategory, changeFrequency: "weekly", priority: 0.8 },
      { url: `${SITE_URL}/brands`,     lastModified: newestBrand,    changeFrequency: "weekly", priority: 0.7 },
      { url: `${SITE_URL}/mag`,        lastModified: newestPost,     changeFrequency: "daily",  priority: 0.8 },
    ];

    return [...staticPages, ...categoryUrls, ...landingEntries, ...brandUrls, ...productUrls, ...postUrls];
 } catch (err) {
    console.error("[sitemap] failed to build dynamic entries:", err);
    throw err;   // بهتر است sitemap موقتاً ۵۰۰ بدهد تا اینکه گوگل فکر کند سایت خالی شده
  }
}
