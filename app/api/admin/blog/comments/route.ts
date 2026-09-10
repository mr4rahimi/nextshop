/**
 * فهرست نظرات مقاله برای پنل — تب «نظرات مقالات».
 *
 * محافظت مسیر در `proxy.ts` انجام می‌شود.
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

  const where: Prisma.BlogCommentWhereInput = {
    status,
    ...(q
      ? {
          OR: [
            { content: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { post: { title: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [comments, total, counts] = await Promise.all([
    prisma.blogComment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        post: { select: { id: true, title: true, slug: true } },
        user: { select: { firstName: true, lastName: true, phone: true } },
        // نظری که این یکی پاسخِ آن است — بدون آن، پاسخ‌ها در پنل بی‌زمینه‌اند
        parent: {
          select: {
            id: true,
            content: true,
            name: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
        replies: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            content: true,
            status: true,
            isStaffReply: true,
            createdAt: true,
            name: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    prisma.blogComment.count({ where }),
    prisma.blogComment.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const byStatus = Object.fromEntries(
    STATUSES.map((s) => [s, counts.find((c) => c.status === s)?._count._all ?? 0]),
  );

  return NextResponse.json(
    serialize({ comments, total, pageSize: PAGE_SIZE, counts: byStatus }),
  );
}
