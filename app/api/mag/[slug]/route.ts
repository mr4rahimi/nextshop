import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export async function GET(_: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const post = await prisma.blogPost.findUnique({
    where: { slug },
    include: {
      category: true,
      tags: { include: { tag: true } },
      relatedProducts: {
        orderBy: { sortOrder: "asc" },
        include: {
          product: {
            select: { id: true, title: true, slug: true, mainImage: true, price: true, salePrice: true, images: { take: 1, select: { url: true } } },
          },
        },
      },
      comments: {
        where: { status: "APPROVED", parentId: null },
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { firstName: true, lastName: true, avatarUrl: true } },
          replies: {
            where: { status: "APPROVED" },
            include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
          },
        },
      },
      _count: { select: { comments: true } },
    },
  });

  if (!post || post.status !== "PUBLISHED") return NextResponse.json({ error: "یافت نشد" }, { status: 404 });

  await prisma.blogPost.update({ where: { slug }, data: { viewCount: { increment: 1 } } });

  const related = await prisma.blogPost.findMany({
    where: {
      status: "PUBLISHED",
      slug: { not: slug },
      categoryId: post.categoryId ?? undefined,
    },
    take: 3,
    orderBy: { publishedAt: "desc" },
    select: {
      id: true, title: true, slug: true, coverImage: true,
      publishedAt: true, readingTime: true,
      category: { select: { title: true, slug: true } },
    },
  });

  return NextResponse.json(serialize({ post, related }));
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const data = await req.json();

  const post = await prisma.blogPost.findUnique({ where: { slug }, select: { id: true } });
  if (!post) return NextResponse.json({ error: "مطلب یافت نشد" }, { status: 404 });

  const comment = await prisma.blogComment.create({
    data: {
      postId:   post.id,
      userId:   data.userId   ?? null,
      name:     data.name     ?? null,
      content:  data.content,
      parentId: data.parentId ?? null,
      status:   "PENDING",
    },
  });

  return NextResponse.json(serialize(comment));
}
