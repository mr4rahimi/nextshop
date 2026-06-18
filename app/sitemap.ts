import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL,                   lastModified: now, changeFrequency: "daily",   priority: 1.0 },
    { url: `${SITE_URL}/products`, lastModified: now, changeFrequency: "daily",   priority: 0.9 },
    { url: `${SITE_URL}/mag`,           lastModified: now, changeFrequency: "daily",   priority: 0.8 },
    { url: `${SITE_URL}/cart`,    lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  try {
    const [products, categories, brands, posts] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 5000,
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

    return [...staticPages, ...productUrls, ...categoryUrls, ...brandUrls, ...postUrls];
  } catch {
    return staticPages;
  }
}
