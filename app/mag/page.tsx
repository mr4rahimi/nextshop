import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import MagHomeClient from "@/components/blog/MagHomeClient";

export const metadata = { title: "مجله" };

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