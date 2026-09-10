/**
 * تأیید، رد، ویرایش، پاسخ رسمی و حذف یک نظر مقاله.
 *
 * پاسخ فروشگاه یک نظرِ فرزند با `isStaffReply` است، نه ستونی روی خود نظر —
 * چون در مقاله گفتگو طبیعی است و همان ساختار، پاسخ کاربر به کاربر را هم
 * می‌پوشاند. پاسخ فروشگاه مستقیم `APPROVED` ثبت می‌شود؛ کسی که تأیید
 * می‌کند خودش نویسنده‌ی آن است.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { getAuthUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { cleanMultiline } from "@/lib/moderation";
import { BLOG_COMMENT_LIMITS } from "@/lib/blog-comments";
import type { CommentStatus } from "@prisma/client";

export const runtime = "nodejs";

const STATUSES = ["PENDING", "APPROVED", "REJECTED"];

const STATUS_LABEL: Record<string, string> = {
  PENDING: "در انتظار",
  APPROVED: "تأیید شد",
  REJECTED: "رد شد",
};

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
  }

  const existing = await prisma.blogComment.findUnique({
    where: { id },
    select: {
      id: true,
      postId: true,
      status: true,
      parentId: true,
      post: { select: { title: true } },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "نظر یافت نشد" }, { status: 404 });
  }

  // پاسخ رسمی فروشگاه — یک نظر تازه، نه ویرایش این یکی
  if (typeof body.replyBody === "string") {
    const text = cleanMultiline(body.replyBody, BLOG_COMMENT_LIMITS.content);
    if (!text) {
      return NextResponse.json({ error: "متن پاسخ خالی است" }, { status: 400 });
    }
    if (existing.parentId) {
      return NextResponse.json(
        { error: "به یک پاسخ نمی‌شود دوباره پاسخ داد" },
        { status: 400 },
      );
    }

    const user = await getAuthUser();

    const reply = await prisma.blogComment.create({
      data: {
        postId: existing.postId,
        parentId: existing.id,
        userId: user?.id ?? null,
        content: text,
        isStaffReply: true,
        status: "APPROVED",
      },
    });

    await logActivity({
      action: "CREATE",
      entity: "BLOG",
      entityId: existing.id,
      entityTitle: existing.post.title,
      summary: "پاسخ فروشگاه به نظر مقاله",
    });

    return NextResponse.json(serialize(reply));
  }

  const data: Record<string, unknown> = {};

  if (typeof body.status === "string") {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "وضعیت نامعتبر است" }, { status: 400 });
    }
    data.status = body.status as CommentStatus;
  }

  // ویرایش متن توسط ادمین — برای پاک‌کردن فحش یا شماره تماس
  if (typeof body.content === "string") {
    const text = cleanMultiline(body.content, BLOG_COMMENT_LIMITS.content);
    if (!text) {
      return NextResponse.json({ error: "متن نظر خالی است" }, { status: 400 });
    }
    data.content = text;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "چیزی برای تغییر نیست" }, { status: 400 });
  }

  const comment = await prisma.blogComment.update({ where: { id }, data });

  if (data.status && data.status !== existing.status) {
    await logActivity({
      action: "UPDATE",
      entity: "BLOG",
      entityId: id,
      entityTitle: existing.post.title,
      summary: `نظر مقاله ${STATUS_LABEL[String(data.status)]}`,
    });
  }

  return NextResponse.json(serialize(comment));
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const existing = await prisma.blogComment.findUnique({
    where: { id },
    select: { id: true, post: { select: { title: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "نظر یافت نشد" }, { status: 404 });
  }

  // پاسخ‌های این نظر با آبشار دیتابیس حذف می‌شوند
  await prisma.blogComment.delete({ where: { id } });

  await logActivity({
    action: "DELETE",
    entity: "BLOG",
    entityId: id,
    entityTitle: existing.post.title,
    summary: "نظر مقاله حذف شد",
  });

  return NextResponse.json({ success: true });
}
