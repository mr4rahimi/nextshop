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
  const where = siteId ? { siteId } : {};

  const [items, total] = await Promise.all([
    prisma.chatConversation.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        userId: true,
        sessionId: true,
        createdAt: true,
        lastMessageAt: true,
        _count: { select: { messages: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { content: true },
        },
      },
    }),
    prisma.chatConversation.count({ where }),
  ]);

  const userIds = items.map((i) => i.userId).filter(Boolean) as string[];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, phone: true, firstName: true, lastName: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  return NextResponse.json({
    page,
    pageSize,
    total,
    items: items.map((c) => {
      const u = c.userId ? userMap.get(c.userId) : null;
      return {
        id: c.id,
        createdAt: c.createdAt,
        lastMessageAt: c.lastMessageAt,
        messageCount: c._count.messages,
        firstMessage: c.messages[0]?.content ?? "",
        user: u
          ? { name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.phone, phone: u.phone }
          : null,
        isGuest: !c.userId,
      };
    }),
  });
}
