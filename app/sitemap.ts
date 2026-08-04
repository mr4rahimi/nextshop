import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { listIndexableLandings } from "@/lib/landing-pages";
import { parseCatalogQuery, buildCatalogWhere } from "@/lib/catalog";

// force-dynamic: SITE_URL must come from the running process env, not build-time static output.
// Each of the 4 deployments has a different SITE_URL in its ecosystem.config.js.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL,                      lastModified: now, changeFrequency: "daily",   priority: 1.0 },
    { url: `${SITE_URL}/products`,        lastModified: now, changeFrequency: "daily",   priority: 0.9 },
    { url: `${SITE_URL}/categories`,      lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
    { url: `${SITE_URL}/brands`,          lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${SITE_URL}/mag`,             lastModified: now, changeFrequency: "daily",   priority: 0.8 },
  ];

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
        url: `${SITE_URL}/collections/${lp.slug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.75,
      });
    }

    const productUrls: MetadataRoute.Sitemap = products.map(p => ({
      url:             `${SITE_URL}/products/${p.slug}`,
      lastModified:    p.updatedAt,
      changeFrequency: "weekly",
      priority:        0.8,
    }));

    const categoryUrls: MetadataRoute.Sitemap = categories.map(c => ({
      url:             `${SITE_URL}/categories/${c.slug}`,
      lastModified:    c.updatedAt,
      changeFrequency: "weekly",
      priority:        0.7,
    }));

    const brandUrls: MetadataRoute.Sitemap = brands.map(b => ({
      url:             `${SITE_URL}/brands/${b.slug}`,
      lastModified:    b.updatedAt,
      changeFrequency: "weekly",
      priority:        0.6,
    }));

    const postUrls: MetadataRoute.Sitemap = posts.map(p => ({
      url:             `${SITE_URL}/mag/${p.slug}`,
      lastModified:    p.updatedAt,
      changeFrequency: "monthly",
      priority:        0.7,
    }));

    return [...staticPages, ...categoryUrls, ...landingEntries, ...brandUrls, ...productUrls, ...postUrls];
 } catch (err) {
    console.error("[sitemap] failed to build dynamic entries:", err);
    throw err;   // بهتر است sitemap موقتاً ۵۰۰ بدهد تا اینکه گوگل فکر کند سایت خالی شده
  }
}
