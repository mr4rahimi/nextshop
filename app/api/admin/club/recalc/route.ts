import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { processOrderForClub, EARNING_STATUSES } from "@/lib/club/rewards";
import { backfillFirstSource } from "@/lib/club/touchpoints";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * بازمحاسبه‌ی باشگاه برای سفارش‌های گذشته
 *
 * لازم است چون قلاب سفارش تازه اضافه شده — سفارش‌های قبلی هرگز امتیاز نگرفتند
 * و آمار خریدشان صفر مانده. یک بار اجرا کافی است، ولی اجرای مجدد بی‌خطر است:
 * `processOrderForClub` تراکنش تکراری نمی‌سازد.
 *
 * ⚠️ عمداً دسته‌ای و با سقف اجرا می‌شود، نه همه‌ی سفارش‌ها در یک درخواست.
 *    فروشگاهی با ده‌ها هزار سفارش وگرنه درخواست را تایم‌اوت می‌کند.
 */
export async function POST(req: Request) {
  const u = await getAuthUser();
  if (!u || u.role !== "ADMIN") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const limit = clampLimit(body?.limit);
  const cursor = typeof body?.cursor === "string" && body.cursor ? body.cursor : null;

  // اولین دور: اعضای قدیمی را هم صاحب firstSource کن
  const backfill = cursor ? { updated: 0 } : await backfillFirstSource();

  const orders = await prisma.order.findMany({
    where: { status: { in: [...EARNING_STATUSES] } },
    select: { id: true },
    orderBy: { id: "asc" },
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  let processed = 0;
  let pointsAwarded = 0;
  let tierChanges = 0;

  for (const o of orders) {
    const r = await processOrderForClub(o.id);
    processed++;
    if (r) {
      pointsAwarded += r.pointsAwarded;
      if (r.tierChanged) tierChanges++;
    }
  }

  const nextCursor = orders.length === limit ? orders[orders.length - 1].id : null;

  return NextResponse.json({
    processed,
    pointsAwarded,
    tierChanges,
    firstSourceBackfilled: backfill.updated,
    nextCursor,
    done: nextCursor === null,
  });
}

function clampLimit(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 100;
  return Math.min(Math.max(Math.floor(n), 1), 200);
}
