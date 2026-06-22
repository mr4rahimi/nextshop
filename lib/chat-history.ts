import { prisma } from "@/lib/prisma";

export async function getOrCreateConversation(opts: {
  conversationId?: string | null;
  userId?: string | null;
  sessionId?: string | null;
  siteId?: string | null;
}): Promise<string> {
  if (opts.conversationId) {
    const existing = await prisma.chatConversation.findUnique({
      where: { id: opts.conversationId },
      select: { id: true, siteId: true },
    });
    if (existing) {
      // Allow if siteId matches, or if existing has no siteId (backward compat)
      if (!existing.siteId || !opts.siteId || existing.siteId === opts.siteId) {
        return existing.id;
      }
    }
  }
  const conv = await prisma.chatConversation.create({
    data: {
      userId: opts.userId ?? null,
      sessionId: opts.sessionId ?? null,
      siteId: opts.siteId ?? null,
    },
    select: { id: true },
  });
  return conv.id;
}

export async function getLastConversation(opts: {
  userId: string;
  siteId: string;
}): Promise<{ id: string; messages: { role: string; content: string }[] } | null> {
  const conv = await prisma.chatConversation.findFirst({
    where: { userId: opts.userId, siteId: opts.siteId },
    orderBy: { lastMessageAt: "desc" },
    select: {
      id: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: { role: true, content: true },
      },
    },
  });
  if (!conv || !conv.messages.length) return null;
  return conv;
}

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
