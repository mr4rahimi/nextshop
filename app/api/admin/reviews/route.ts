/**
 * فهرست نظرات محصول برای پنل — تب «نظرات فروشگاه».
 *
 * محافظت مسیر در `proxy.ts` انجام می‌شود؛ هر چیزی زیر `/api/admin/` بدون
 * توکن ادمین اصلاً به اینجا نمی‌رسد.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import type { CommentStatus, Prisma } from "@prisma/client";

export const runtime = "nodejs";

const PAGE_SIZE = 20;
const STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("status") ?? "PENDING";
  const status = (STATUSES as readonly string[]).includes(raw)
    ? (raw as CommentStatus)
    : "PENDING";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1") || 1);
  const q = (url.searchParams.get("q") ?? "").trim();

  const where: Prisma.ReviewWhereInput = {
    status,
    ...(q
      ? {
          OR: [
            { body: { contains: q, mode: "insensitive" } },
            { title: { contains: q, mode: "insensitive" } },
            { guestName: { contains: q, mode: "insensitive" } },
            { product: { title: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [reviews, total, counts] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        product: { select: { id: true, title: true, slug: true, mainImage: true } },
        user: { select: { firstName: true, lastName: true, phone: true } },
        replyBy: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.review.count({ where }),
    prisma.review.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const byStatus = Object.fromEntries(
    STATUSES.map((s) => [
      s,
      counts.find((c) => c.status === s)?._count._all ?? 0,
    ]),
  );

  return NextResponse.json(
    serialize({ reviews, total, pageSize: PAGE_SIZE, counts: byStatus }),
  );
}
