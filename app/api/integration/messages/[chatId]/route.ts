import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enqueue } from "@/lib/integration/core/queue";
import { getAdapter } from "@/lib/integration/core/adapter-registry";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ chatId: string }> };

// GET /api/integration/messages/[chatId] — پیام‌های یک گفت‌وگو
export async function GET(req: NextRequest, { params }: Ctx) {
  const { chatId } = await params;

  const chat = await prisma.integChat.findUnique({
    where:   { id: chatId },
    include: { platform: { select: { name: true } } },
  });
  if (!chat) return NextResponse.json({ error: "گفت‌وگو پیدا نشد" }, { status: 404 });

  const take = Math.min(500, Math.max(20, Number(req.nextUrl.searchParams.get("take") ?? 200)));

  // تازه‌ترین‌ها را می‌گیریم ولی به ترتیب زمان برمی‌گردانیم تا رشته درست خوانده شود.
  const rows = await prisma.integChatMessage.findMany({
    where:   { chatId },
    orderBy: { sentAt: "desc" },
    take,
  });

  const adapter   = getAdapter(chat.platformCode);
  const canReply  = Boolean(adapter?.sendMessage);

  return NextResponse.json({
    chat: {
      id:            chat.id,
      platformCode:  chat.platformCode,
      platformName:  chat.platform.name,
      chatType:      chat.chatType,
      contactName:   chat.contactName,
      contactAvatar: chat.contactAvatar,
      unseenCount:   chat.unseenCount,
      canReply:      canReply && chat.chatType === "private",
    },
    messages: rows.reverse().map((m) => ({
      id:         m.id,
      direction:  m.direction,
      senderName: m.senderName,
      text:       m.text,
      files:      m.files,
      sentAt:     m.sentAt,
      sendStatus: m.sendStatus,
      sendError:  m.sendError,
    })),
  });
}

// POST /api/integration/messages/[chatId] — ثبت پاسخ و صف‌کردن ارسال
export async function POST(req: NextRequest, { params }: Ctx) {
  const { chatId } = await params;
  const body = await req.json().catch(() => ({})) as { text?: string };

  const text = body.text?.trim();
  if (!text) return NextResponse.json({ error: "متن پیام خالی است" }, { status: 400 });

  const chat = await prisma.integChat.findUnique({ where: { id: chatId } });
  if (!chat) return NextResponse.json({ error: "گفت‌وگو پیدا نشد" }, { status: 404 });

  const adapter = getAdapter(chat.platformCode);
  if (!adapter?.sendMessage) {
    return NextResponse.json({ error: "ارسال پیام برای این پلتفرم پشتیبانی نمی‌شود" }, { status: 400 });
  }
  if (chat.chatType !== "private") {
    return NextResponse.json({ error: "فقط در گفت‌وگوی خصوصی می‌توان پاسخ داد" }, { status: 400 });
  }

  // ردیف بدون externalId ثبت می‌شود تا ادمین بلافاصله پیامش را در رشته ببیند؛
  // شناسه واقعی بعد از ارسال موفق توسط worker پر می‌شود.
  const message = await prisma.integChatMessage.create({
    data: {
      chatId:     chat.id,
      direction:  "OUT",
      text,
      sentAt:     new Date(),
      sendStatus: "PENDING",
    },
  });

  await enqueue({
    type:         "SEND_MESSAGE",
    platformCode: chat.platformCode,
    payload:      { messageId: message.id },
    priority:     1,
  });

  return NextResponse.json({ ok: true, id: message.id });
}
