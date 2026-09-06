import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import MagPostClient from "@/components/blog/MagPostClient";
import { SITE_URL, canonicalUrl, buildBaseMetadata, buildArticleSchema, buildBreadcrumbSchema, buildFAQSchema } from "@/lib/seo";
import { normalizeFaq } from "@/lib/faq";

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  try {
    const post = await prisma.blogPost.findUnique({
      where: { slug },
      select: { title: true, seoTitle: true, seoDescription: true, seoKeywords: true, coverImage: true, excerpt: true },
    });
    if (!post) return { title: "مطلب یافت نشد" };
    return buildBaseMetadata({
      title:       post.seoTitle       ?? post.title,
      description: post.seoDescription ?? post.excerpt ?? undefined,
      keywords:    post.seoKeywords    ?? undefined,
      image:       post.coverImage,
      path:        `/mag/${slug}`,
      ogType:      "article",
    });
  } catch { return { title: "مجله" }; }
}

export default async function MagPostPage({ params }: Props) {
  const { slug } = await params;
  let post: any = null;
  let related: any[] = [];
  let settings: any = null;

  try {
    [post, settings] = await Promise.all([
      prisma.blogPost.findUnique({
        where: { slug },
        include: {
          category: true,
          tags: { include: { tag: true } },
          relatedProducts: {
            orderBy: { sortOrder: "asc" },
            include: { product: { select: { id: true, title: true, slug: true, mainImage: true, price: true, salePrice: true, images: { take: 1, select: { url: true } } } } },
          },
          comments: {
            where: { status: "APPROVED", parentId: null },
            orderBy: { createdAt: "desc" },
            include: {
              user: { select: { firstName: true, lastName: true, avatarUrl: true } },
              replies: { where: { status: "APPROVED" }, include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
            },
          },
          _count: { select: { comments: true } },
        },
      }),
      prisma.storeSettings.findUnique({ where: { id: "singleton" } }),
    ]);
  } catch (e) { notFound(); }

  if (!post || post.status !== "PUBLISHED") notFound();

  try {
    related = await prisma.blogPost.findMany({
      where: { status: "PUBLISHED", slug: { not: slug }, ...(post.categoryId ? { categoryId: post.categoryId } : {}) },
      take: 3, orderBy: { publishedAt: "desc" },
      select: { id: true, title: true, slug: true, coverImage: true, publishedAt: true, readingTime: true, category: { select: { title: true, slug: true } } },
    });
  } catch {}

  await prisma.blogPost.update({ where: { slug }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  const articleSchema = buildArticleSchema({
    title:          post.title,
    description:    post.seoDescription ?? post.excerpt,
    image:          post.coverImage,
    url:            canonicalUrl(`/mag/${slug}`),
    publishedAt:    post.publishedAt,
    updatedAt:      post.updatedAt,
    publisherName:  settings?.storeName  ?? "مجله",
    publisherLogo:  settings?.storeLogo  ?? null,
  });

  const faqSchema = buildFAQSchema(normalizeFaq(post.faq));

  const breadcrumb = buildBreadcrumbSchema([
    { name: "خانه", url: SITE_URL },
    { name: "مجله", url: `${SITE_URL}/mag` },
    ...(post.category ? [{ name: post.category.title, url: `${SITE_URL}/mag?cat=${post.category.slug}` }] : []),
    { name: post.title, url: canonicalUrl(`/mag/${slug}`) },
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      {faqSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      )}
      <MagPostClient post={serialize(post)} related={serialize(related)} />
    </>
  );
}
