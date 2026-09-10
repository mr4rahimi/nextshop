import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { getAuthUser } from "@/lib/auth";
import { clean, cleanMultiline, clientIp, isValidEmail } from "@/lib/moderation";
import {
  BLOG_COMMENT_LIMITS,
  MAX_PER_IP_PER_HOUR,
  approvedCommentCount,
  approvedCommentsQuery,
} from "@/lib/blog-comments";

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
      comments: approvedCommentsQuery(),
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

  // شمارنده جدا حساب می‌شود چون `_count` نظرهای در انتظار تأیید را هم می‌شمارد
  const commentCount = await approvedCommentCount(post.id);

  return NextResponse.json(
    serialize({ post: { ...post, _count: { comments: commentCount } }, related }),
  );
}

/**
 * ثبت نظر روی مقاله — عمومی، بدون نیاز به ورود.
 *
 * ⚠️ نسخه‌ی قبلی `userId` را **از بدنه‌ی درخواست** می‌خواند، یعنی هر کسی
 * می‌توانست با فرستادن شناسه‌ی دیگری نظری به نام او ثبت کند. حالا هویت فقط
 * از کوکی خوانده می‌شود و هر `userId` در بدنه نادیده گرفته می‌شود.
 */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  let data: Record<string, unknown>;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
  }

  const content = cleanMultiline(data.content, BLOG_COMMENT_LIMITS.content);
  if (content.length < 3) {
    return NextResponse.json({ error: "متن نظر را بنویسید" }, { status: 400 });
  }

  // نظر فقط روی مقاله‌ی منتشرشده — پیش‌نویس صفحه‌ی عمومی ندارد
  const post = await prisma.blogPost.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { id: true },
  });
  if (!post) {
    return NextResponse.json({ error: "مطلب یافت نشد" }, { status: 404 });
  }

  // پاسخ فقط به نظری که خودش تأیید شده و روی همین مقاله است، و فقط یک لایه:
  // پاسخ به پاسخ، رشته‌ی تودرتویی می‌سازد که صفحه جایی برای نمایشش ندارد
  let parentId: string | null = null;
  if (typeof data.parentId === "string" && data.parentId) {
    const parent = await prisma.blogComment.findFirst({
      where: { id: data.parentId, postId: post.id, status: "APPROVED", parentId: null },
      select: { id: true },
    });
    if (!parent) {
      return NextResponse.json({ error: "نظری که به آن پاسخ داده‌اید یافت نشد" }, { status: 400 });
    }
    parentId = parent.id;
  }

  const user = await getAuthUser();

  let name: string | null = null;
  let email: string | null = null;

  if (!user) {
    name = clean(data.name, BLOG_COMMENT_LIMITS.name);
    if (name.length < 2) {
      return NextResponse.json({ error: "نام خود را بنویسید" }, { status: 400 });
    }

    const raw = clean(data.email, BLOG_COMMENT_LIMITS.email);
    if (raw) {
      if (!isValidEmail(raw)) {
        return NextResponse.json({ error: "ایمیل معتبر نیست" }, { status: 400 });
      }
      email = raw.toLowerCase();
    }
  }

  const ip = clientIp(req);

  if (ip) {
    const recent = await prisma.blogComment.count({
      where: { ip, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    if (recent >= MAX_PER_IP_PER_HOUR) {
      return NextResponse.json(
        { error: "تعداد نظرهای ثبت‌شده از این دستگاه زیاد است. کمی بعد دوباره تلاش کنید." },
        { status: 429 },
      );
    }
  }

  await prisma.blogComment.create({
    data: {
      postId: post.id,
      userId: user?.id ?? null,
      name,
      email,
      content,
      parentId,
      status: "PENDING",
      ip,
      userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
  });

  return NextResponse.json({
    success: true,
    message: "نظر شما ثبت شد و پس از تأیید منتشر می‌شود.",
  });
}
