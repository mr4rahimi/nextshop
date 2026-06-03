import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const post = await prisma.blogPost.findUnique({
    where: { id },
    include: {
      category: true,
      tags: { include: { tag: true } },
      relatedProducts: {
        include: { product: { select: { id: true, title: true, mainImage: true, price: true, salePrice: true } } },
        orderBy: { sortOrder: "asc" },
      },
      _count: { select: { comments: true } },
    },
  });
  if (!post) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
  return NextResponse.json(serialize(post));
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const data = await req.json();

  const words = (data.content ?? "").replace(/<[^>]+>/g, "").split(/\s+/).length;
  const readingTime = Math.max(1, Math.round(words / 200));

  // حذف و بازسازی tags و products
  await prisma.blogPostTag.deleteMany({ where: { postId: id } });
  await prisma.blogPostProduct.deleteMany({ where: { postId: id } });

  const post = await prisma.blogPost.update({
    where: { id },
    data: {
      title:          data.title,
      slug:           data.slug,
      excerpt:        data.excerpt        ?? null,
      content:        data.content        ?? "",
      coverImage:     data.coverImage     ?? null,
      videoUrl:       data.videoUrl       ?? null,
      categoryId:     data.categoryId     ?? null,
      status:         data.status,
      publishedAt:    data.status === "PUBLISHED" && !data.publishedAt ? new Date() : data.publishedAt ?? null,
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

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await prisma.blogPost.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
