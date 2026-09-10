/**
 * رأی «مفید بود» روی یک نظر تأییدشده.
 *
 * هر رأی‌دهنده یک `voterKey` دارد: کاربر عضو شناسه‌ی خودش، مهمان IP.
 * کلید یکتای دیتابیس تضمین می‌کند رأی دوم همان نفر ثبت نشود — بدون آن
 * شمارنده با چند بار کلیک بی‌معنی می‌شد.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { clientIp, voterKey } from "@/lib/moderation";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
  }

  const helpful = body.helpful === true;

  const review = await prisma.review.findFirst({
    where: { id, status: "APPROVED" },
    select: { id: true },
  });
  if (!review) {
    return NextResponse.json({ error: "نظر یافت نشد" }, { status: 404 });
  }

  const user = await getAuthUser();
  const key = voterKey(user?.id ?? null, clientIp(req));

  if (!key) {
    return NextResponse.json({ error: "امکان ثبت رأی نیست" }, { status: 400 });
  }

  try {
    await prisma.reviewVote.create({
      data: { reviewId: id, voterKey: key, helpful },
    });
  } catch {
    // رأی تکراری — خطا نیست، فقط چیزی عوض نمی‌شود
    return NextResponse.json({ success: true, alreadyVoted: true });
  }

  const updated = await prisma.review.update({
    where: { id },
    data: helpful ? { helpfulYes: { increment: 1 } } : { helpfulNo: { increment: 1 } },
    select: { helpfulYes: true, helpfulNo: true },
  });

  return NextResponse.json({ success: true, ...updated });
}
