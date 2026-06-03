import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { slugify } from "@/lib/slugify";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url    = new URL(req.url);
  const page   = parseInt(url.searchParams.get("page") ?? "1");
  const status = url.searchParams.get("status") ?? "";
  const q      = url.searchParams.get("q") ?? "";
  const PAGE   = 20;

  const where: any = {};
  if (status) where.status = status;
  if (q) where.title = { contains: q, mode: "insensitive" };

  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE, take: PAGE,
      select: {
        id: true, title: true, slug: true, status: true,
        coverImage: true, publishedAt: true, viewCount: true,
        readingTime: true, createdAt: true,
        category: { select: { title: true } },
        _count: { select: { comments: true } },
      },
    }),
    prisma.blogPost.count({ where }),
  ]);

  return NextResponse.json(serialize({ posts, total, page, pageSize: PAGE }));
}

export async function POST(req: Request) {
  const data = await req.json();
  const slug = data.slug || slugify(data.title);

  // محاسبه زمان مطالعه
  const words = (data.content ?? "").replace(/<[^>]+>/g, "").split(/\s+/).length;
  const readingTime = Math.max(1, Math.round(words / 200));

  const post = await prisma.blogPost.create({
    data: {
      title:          data.title,
      slug,
      excerpt:        data.excerpt        ?? null,
      content:        data.content        ?? "",
      coverImage:     data.coverImage     ?? null,
      videoUrl:       data.videoUrl       ?? null,
      categoryId:     data.categoryId     ?? null,
      status:         data.status         ?? "DRAFT",
      publishedAt:    data.status === "PUBLISHED" ? new Date() : null,
      seoTitle:       data.seoTitle       ?? null,
      seoDescription: data.seoDescription ?? null,
      seoKeywords:    data.seoKeywords    ?? null,
      readingTime,
      tags: data.tags?.length ? {
        create: data.tags.map((tagId: string) => ({ tag: { connect: { id: tagId } } })),
      } : undefined,
      relatedProducts: data.productIds?.length ? {
        create: data.productIds.map((productId: string, i: number) => ({ productId, sortOrder: i })),
      } : undefined,
    },
  });

  return NextResponse.json(serialize(post));
}
