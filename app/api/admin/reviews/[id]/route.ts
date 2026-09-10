/**
 * تأیید، رد، پاسخ و حذف یک نظر.
 *
 * هر تغییری که می‌تواند مجموعه‌ی نظرهای تأییدشده را عوض کند، بلافاصله
 * `recomputeProductRating` را صدا می‌زند — وگرنه ستاره‌ی صفحه‌ی محصول و
 * اسکیمای گوگل با فهرست نظرها نمی‌خوانند.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { getAuthUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { REVIEW_LIMITS, recomputeProductRating } from "@/lib/reviews";
import { clean, cleanMultiline } from "@/lib/moderation";
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

  const existing = await prisma.review.findUnique({
    where: { id },
    select: { id: true, productId: true, status: true, product: { select: { title: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "نظر یافت نشد" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};

  if (typeof body.status === "string") {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "وضعیت نامعتبر است" }, { status: 400 });
    }
    data.status = body.status as CommentStatus;
  }

  // پاسخ فروشگاه: رشته‌ی خالی یعنی پاسخ برداشته شود
  if (typeof body.replyBody === "string") {
    const reply = cleanMultiline(body.replyBody, REVIEW_LIMITS.replyBody);
    const user = await getAuthUser();
    data.replyBody = reply || null;
    data.replyAt = reply ? new Date() : null;
    data.replyById = reply ? user?.id ?? null : null;
  }

  // ویرایش متن نظر توسط ادمین — برای پاک‌کردن فحش یا شماره تماس
  if (typeof body.body === "string") {
    data.body = cleanMultiline(body.body, REVIEW_LIMITS.body) || null;
  }
  if (typeof body.title === "string") {
    data.title = clean(body.title, REVIEW_LIMITS.title) || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "چیزی برای تغییر نیست" }, { status: 400 });
  }

  const review = await prisma.review.update({ where: { id }, data });

  if (data.status && data.status !== existing.status) {
    await recomputeProductRating(existing.productId);
    await logActivity({
      action: "UPDATE",
      entity: "OTHER",
      entityId: id,
      entityTitle: existing.product.title,
      summary: `نظر محصول ${STATUS_LABEL[String(data.status)]}`,
    });
  }

  return NextResponse.json(serialize(review));
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const existing = await prisma.review.findUnique({
    where: { id },
    select: { productId: true, status: true, product: { select: { title: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "نظر یافت نشد" }, { status: 404 });
  }

  await prisma.review.delete({ where: { id } });

  if (existing.status === "APPROVED") {
    await recomputeProductRating(existing.productId);
  }

  await logActivity({
    action: "DELETE",
    entity: "OTHER",
    entityId: id,
    entityTitle: existing.product.title,
    summary: "نظر محصول حذف شد",
  });

  return NextResponse.json({ success: true });
}
