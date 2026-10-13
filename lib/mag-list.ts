/**
 * کوئری مشترک فهرست مجله — صفحه‌ی سرور (/mag) و API بارگذاری بیشتر
 * (/api/mag) باید دقیقاً یک نتیجه بدهند، وگرنه «مطالب بیشتر» تکراری یا
 * جاافتاده می‌آورد.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const MAG_PAGE_SIZE = 12;

export type MagSort = "newest" | "popular" | "discussed";

export function magListWhere(f: { cat?: string; tag?: string; q?: string }): Prisma.BlogPostWhereInput {
  const where: Prisma.BlogPostWhereInput = { status: "PUBLISHED" };
  if (f.cat) where.category = { slug: f.cat };
  if (f.tag) where.tags = { some: { tag: { slug: f.tag } } };
  const q = f.q?.trim();
  if (q) {
    where.OR = [
      { title:   { contains: q, mode: "insensitive" } },
      { excerpt: { contains: q, mode: "insensitive" } },
    ];
  }
  return where;
}

export function magListOrder(sort: string | null | undefined): Prisma.BlogPostOrderByWithRelationInput[] {
  if (sort === "popular")   return [{ viewCount: "desc" }, { publishedAt: "desc" }];
  if (sort === "discussed") return [{ comments: { _count: "desc" } }, { publishedAt: "desc" }];
  return [{ publishedAt: "desc" }, { id: "desc" }];
}

export const MAG_LIST_SELECT = {
  id: true, title: true, slug: true, excerpt: true, videoUrl: true,
  coverImage: true, publishedAt: true, readingTime: true, viewCount: true,
  category: { select: { title: true, slug: true } },
  tags: { take: 3, select: { tag: { select: { title: true, slug: true } } } },
  _count: { select: { comments: { where: { status: "APPROVED" as const } } } },
} satisfies Prisma.BlogPostSelect;

/**
 * یک بازدید به مقاله اضافه می‌کند **بدون دست‌زدن به `updatedAt`**.
 *
 * ⚠️ `prisma.blogPost.update` ستون `@updatedAt` را هم جلو می‌برد، و `updatedAt`
 * همان `lastmod` سایت‌مپ است؛ آن‌وقت هر بازدید (حتی خزیدن خود گوگل) مقاله را
 * «تازه ویرایش‌شده» نشان می‌داد و گوگل lastmod کل سایت‌مپ را بی‌اعتبار می‌دانست.
 * SQL خام از `@updatedAt` پریزما رد نمی‌شود.
 */
export async function incrementPostView(slug: string): Promise<void> {
  await prisma.$executeRaw`UPDATE "BlogPost" SET "viewCount" = "viewCount" + 1 WHERE slug = ${slug}`;
}
