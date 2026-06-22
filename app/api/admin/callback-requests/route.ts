import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = 20;
  const siteId = url.searchParams.get("siteId") || null;
  const status = url.searchParams.get("status") || null;

  const where: { siteId?: string; status?: string } = {};
  if (siteId) where.siteId = siteId;
  if (status) where.status = status;

  const [items, total] = await Promise.all([
    prisma.callbackRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.callbackRequest.count({ where }),
  ]);

  const userIds = items.map((i) => i.userId).filter(Boolean) as string[];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, phone: true, firstName: true, lastName: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const [pendingCount, contactedCount, doneCount] = await Promise.all([
    prisma.callbackRequest.count({ where: { ...(siteId ? { siteId } : {}), status: "pending" } }),
    prisma.callbackRequest.count({ where: { ...(siteId ? { siteId } : {}), status: "contacted" } }),
    prisma.callbackRequest.count({ where: { ...(siteId ? { siteId } : {}), status: "done" } }),
  ]);

  return NextResponse.json({
    page,
    pageSize,
    total,
    counts: { pending: pendingCount, contacted: contactedCount, done: doneCount },
    items: items.map((r) => {
      const u = r.userId ? userMap.get(r.userId) : null;
      return {
        id: r.id,
        phone: r.phone,
        siteId: r.siteId,
        conversationId: r.conversationId,
        status: r.status,
        note: r.note,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        user: u
          ? { name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.phone, phone: u.phone }
          : null,
      };
    }),
  });
}
