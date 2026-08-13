import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import MagHomeClient from "@/components/blog/MagHomeClient";
import { buildBaseMetadata } from "@/lib/seo";

// قبلاً فقط `title` بود: صفحه در sitemap هست و ایندکس می‌شود ولی canonical
// نداشت، پس هر واریانت آدرس می‌توانست جداگانه ایندکس شود.
export const metadata = buildBaseMetadata({
  title: "مجله",
  description: "آخرین مقالات، راهنمای خرید و اخبار فروشگاه",
  path: "/mag",
});

export default async function MagPage() {
  const [posts, categories] = await Promise.all([
    prisma.blogPost.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 12,
      select: {
        id: true, title: true, slug: true, excerpt: true,
        coverImage: true, publishedAt: true, readingTime: true, viewCount: true,
        category: { select: { title: true, slug: true } },
        tags: { take: 2, select: { tag: { select: { title: true, slug: true } } } },
        _count: { select: { comments: true } },
      },
    }),
    prisma.blogCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { posts: { where: { status: "PUBLISHED" } } } } },
    }),
  ]).catch(() => [[], []]);

  return <MagHomeClient initialPosts={serialize(posts)} categories={serialize(categories)} />;
}