import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url      = new URL(req.url);
  const page     = parseInt(url.searchParams.get("page") ?? "1");
  const catSlug  = url.searchParams.get("cat") ?? "";
  const tag      = url.searchParams.get("tag") ?? "";
  const PAGE     = 12;

  const where: any = { status: "PUBLISHED" };
  if (catSlug) where.category = { slug: catSlug };
  if (tag) where.tags = { some: { tag: { slug: tag } } };

  const [posts, total, categories] = await Promise.all([
    prisma.blogPost.findMany({
      where, orderBy: { publishedAt: "desc" },
      skip: (page - 1) * PAGE, take: PAGE,
      select: {
        id: true, title: true, slug: true, excerpt: true,
        coverImage: true, publishedAt: true, readingTime: true, viewCount: true,
        category: { select: { title: true, slug: true } },
        tags: { select: { tag: { select: { title: true, slug: true } } }, take: 3 },
        _count: { select: { comments: true } },
      },
    }),
    prisma.blogPost.count({ where }),
    prisma.blogCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { posts: { where: { status: "PUBLISHED" } } } } },
    }),
  ]);

  return NextResponse.json(serialize({ posts, total, page, pageSize: PAGE, categories }));
}
