import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { parseRange } from "@/lib/reports";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;

/**
 * فهرست فعالیت‌ها با فیلتر و صفحه‌بندی مبتنی بر cursor.
 *
 * پارامترها: preset/from/to، actorId، action، entity، q (جستجو در عنوان و شرح)،
 * cursor (شناسه‌ی آخرین رکورد صفحه‌ی قبل).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sp = url.searchParams;
  const range = parseRange(sp);

  const where: Prisma.ActivityLogWhereInput = {
    createdAt: { gte: range.from, lte: range.to },
  };

  const actorId = sp.get("actorId");
  if (actorId) where.actorId = actorId;

  const action = sp.get("action");
  if (action) where.action = action as never;

  const entity = sp.get("entity");
  if (entity) where.entity = entity as never;

  const q = sp.get("q")?.trim();
  if (q) {
    where.OR = [
      { entityTitle: { contains: q, mode: "insensitive" } },
      { summary: { contains: q, mode: "insensitive" } },
      { actorName: { contains: q, mode: "insensitive" } },
      { entityId: q },
    ];
  }

  const cursor = sp.get("cursor");

  const rows = await prisma.activityLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > PAGE_SIZE;
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  return NextResponse.json({
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  });
}
