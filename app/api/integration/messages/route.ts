import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enqueue } from "@/lib/integration/core/queue";

export const dynamic = "force-dynamic";

// GET /api/integration/messages?platform=basalam&type=private&q=...&unseen=1
export async function GET(req: NextRequest) {
  const sp       = req.nextUrl.searchParams;
  const platform = sp.get("platform");
  const q        = sp.get("q")?.trim();
  const take     = Math.min(200, Math.max(10, Number(sp.get("take") ?? 60)));

  // کانال‌های اطلاع‌رسانی باسلام پیام مشتری نیستند و پیش‌فرض نمایش داده نمی‌شوند.
  const type = sp.get("type") ?? "private";

  const chats = await prisma.integChat.findMany({
    where: {
      ...(platform ? { platformCode: platform } : {}),
      ...(type === "all" ? {} : { chatType: type }),
      ...(sp.get("unseen") ? { unseenCount: { gt: 0 } } : {}),
      ...(q ? { contactName: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    take,
    include: { platform: { select: { name: true } } },
  });

  return NextResponse.json({
    chats: chats.map((c) => ({
      id:              c.id,
      platformCode:    c.platformCode,
      platformName:    c.platform.name,
      chatType:        c.chatType,
      contactName:     c.contactName,
      contactAvatar:   c.contactAvatar,
      unseenCount:     c.unseenCount,
      lastMessageAt:   c.lastMessageAt,
      lastMessageText: c.lastMessageText,
    })),
  });
}

// POST /api/integration/messages — همگام‌سازی دستی
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { platform?: string };

  const connections = await prisma.integConnection.findMany({
    where:  {
      status: { in: ["CONNECTED", "SYNCING"] },
      ...(body.platform ? { platformCode: body.platform } : {}),
      platform: { type: "MARKETPLACE" },
    },
    select: { platformCode: true },
  });

  if (connections.length === 0) {
    return NextResponse.json({ error: "هیچ بازارگاه متصلی پیدا نشد" }, { status: 400 });
  }

  for (const conn of connections) {
    // اگر دور بعدی از قبل در صف است، دوباره صف نمی‌کنیم — فقط جلو می‌اندازیمش.
    const pending = await prisma.integJob.findFirst({
      where:  { platformCode: conn.platformCode, type: "FETCH_CHATS", status: "PENDING" },
      select: { id: true },
    });

    if (pending) {
      await prisma.integJob.update({ where: { id: pending.id }, data: { scheduledAt: new Date() } });
    } else {
      await enqueue({ type: "FETCH_CHATS", platformCode: conn.platformCode, payload: {}, priority: 1 });
    }
  }

  return NextResponse.json({ ok: true, queued: connections.map((c) => c.platformCode) });
}
