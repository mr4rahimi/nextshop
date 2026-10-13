import { notFound, permanentRedirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import MagPostClient from "@/components/blog/MagPostClient";
import { SITE_URL, canonicalUrl, encodeSlug, buildBaseMetadata, buildArticleSchema, buildBreadcrumbSchema, buildFAQSchema } from "@/lib/seo";
import { normalizeFaq } from "@/lib/faq";
import { approvedCommentCount, approvedCommentsQuery } from "@/lib/blog-comments";
import { publicAuthorName } from "@/lib/moderation";
import type { SchemaComment } from "@/lib/seo";
import { MAG_LIST_SELECT, incrementPostView } from "@/lib/mag-list";
import { countWords, htmlToText } from "@/lib/blog-seo";

interface Props { params: Promise<{ slug: string }> }

/**
 * `/mag/MyPrinter-Cartridge` به اسلاگ واقعی `myprinter-cartridge` می‌رود (۳۰۸).
 * جست‌وجوی اسلاگ در دیتابیس به بزرگی حروف حساس است و لینک‌های بیرونی و
 * گوگل گاهی شکل دیگری دارند — قبلاً ۴۰۴ می‌شد (ممیزی مهر ۱۴۰۵).
 * بیرون از try صدا زده شود: `permanentRedirect` با throw کار می‌کند.
 */
async function redirectCaseVariant(slug: string) {
  const hit = await prisma.blogPost
    .findFirst({
      where: { slug: { equals: slug, mode: "insensitive" }, status: "PUBLISHED" },
      select: { slug: true },
    })
    .catch(() => null);
  if (hit && hit.slug !== slug) permanentRedirect(`/mag/${encodeSlug(hit.slug)}`);
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  try {
    const post = await prisma.blogPost.findUnique({
      where: { slug },
      select: { title: true, seoTitle: true, seoDescription: true, seoKeywords: true, coverImage: true, excerpt: true, canonicalUrl: true, noIndex: true },
    });
    if (!post) return { title: "مطلب یافت نشد" };
    const canon = post.canonicalUrl?.trim();
    const meta = buildBaseMetadata({
      title:       post.seoTitle       || post.title,
      description: post.seoDescription || post.excerpt || undefined,
      keywords:    post.seoKeywords    || undefined,
      image:       post.coverImage,
      path:        `/mag/${slug}`,
      ogType:      "article",
      noIndex:     post.noIndex,
      // noindex مقاله لینک‌هایش را بی‌اعتبار نمی‌کند
      followWhenNoIndex: true,
      ...(canon && canon.startsWith("/") ? { canonicalPath: canon } : {}),
    });
    // canonical کامل (دامنه‌ی دیگر) مستقیم می‌نشیند؛ canonicalUrl() فقط مسیر می‌گیرد
    if (canon && /^https?:\/\//i.test(canon)) meta.alternates = { canonical: canon };
    return meta;
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
          comments: approvedCommentsQuery(),
        },
      }),
      prisma.storeSettings.findUnique({ where: { id: "singleton" } }),
    ]);
  } catch (e) { notFound(); }

  if (!post) await redirectCaseVariant(slug);
  if (!post || post.status !== "PUBLISHED") notFound();

  try {
    related = await prisma.blogPost.findMany({
      where: { status: "PUBLISHED", slug: { not: slug }, ...(post.categoryId ? { categoryId: post.categoryId } : {}) },
      take: 4, orderBy: { publishedAt: "desc" },
      select: MAG_LIST_SELECT,
    });
  } catch {}

  await incrementPostView(slug).catch(() => {});

  /**
   * شمارنده جدا حساب می‌شود چون `_count` پریزما نظرهای در انتظار تأیید و
   * ردشده را هم می‌شمارد — عددی که تا امروز بالای بخش نظرات دیده می‌شد با
   * فهرست زیرش نمی‌خواند.
   */
  const commentCount = await approvedCommentCount(post.id);

  /** نام مهمان در `name` می‌نشیند نه `guestName`، پس نگاشت می‌شود */
  const toSchemaComment = (c: any): SchemaComment => ({
    author: c.isStaffReply && !c.user
      ? (settings?.storeName ?? "پشتیبانی فروشگاه")
      : publicAuthorName({ guestName: c.name, user: c.user }),
    text: c.content,
    datePublished: new Date(c.createdAt).toISOString().slice(0, 10),
    replies: (c.replies ?? []).map(toSchemaComment),
  });

  const articleSchema = buildArticleSchema({
    title:          post.title,
    description:    post.seoDescription ?? post.excerpt,
    image:          post.coverImage,
    url:            canonicalUrl(`/mag/${slug}`),
    publishedAt:    post.publishedAt,
    updatedAt:      post.updatedAt,
    publisherName:  settings?.storeName  ?? "مجله",
    publisherLogo:  settings?.storeLogo  ?? null,
    comments:       (post.comments ?? []).map(toSchemaComment),
    commentCount,
    section:        post.category?.title ?? null,
    keywords:       [post.focusKeyword, post.seoKeywords].filter(Boolean).join("، ") || null,
    wordCount:      countWords(htmlToText(post.content ?? "")),
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
      <MagPostClient
        post={serialize({ ...post, _count: { comments: commentCount } })}
        related={serialize(related)}
        storeName={settings?.storeName ?? null}
      />
    </>
  );
}
