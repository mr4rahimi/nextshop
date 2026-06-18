import { prisma } from "@/lib/prisma";

// یک مکالمه را پیدا یا ایجاد می‌کند
export async function getOrCreateConversation(opts: {
  conversationId?: string | null;
  userId?: string | null;
  sessionId?: string | null;
}): Promise<string> {
  if (opts.conversationId) {
    const existing = await prisma.chatConversation.findUnique({
      where: { id: opts.conversationId },
      select: { id: true },
    });
    if (existing) return existing.id;
  }
  const conv = await prisma.chatConversation.create({
    data: {
      userId: opts.userId ?? null,
      sessionId: opts.sessionId ?? null,
    },
    select: { id: true },
  });
  return conv.id;
}

// پیام را ذخیره و زمان آخرین پیام مکالمه را به‌روز می‌کند
export async function saveMessage(opts: {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  context?: string | null;
}) {
  await prisma.chatMessage.create({
    data: {
      conversationId: opts.conversationId,
      role: opts.role,
      content: opts.content,
      context: opts.context ?? null,
    },
  });
  await prisma.chatConversation.update({
    where: { id: opts.conversationId },
    data: { lastMessageAt: new Date() },
  });
}