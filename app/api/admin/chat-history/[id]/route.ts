import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";

// جزئیات یک مکالمه با همه‌ی پیام‌ها
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const { id } = await ctx.params;

  const conv = await prisma.chatConversation.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      sessionId: true,
      createdAt: true,
      lastMessageAt: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, content: true, context: true, createdAt: true },
      },
    },
  });

  if (!conv) {
    return NextResponse.json({ error: "مکالمه یافت نشد" }, { status: 404 });
  }

  let userInfo = null;
  if (conv.userId) {
    const u = await prisma.user.findUnique({
      where: { id: conv.userId },
      select: { phone: true, firstName: true, lastName: true, email: true },
    });
    if (u) {
      userInfo = {
        name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.phone,
        phone: u.phone,
        email: u.email,
      };
    }
  }

  return NextResponse.json({
    id: conv.id,
    createdAt: conv.createdAt,
    lastMessageAt: conv.lastMessageAt,
    isGuest: !conv.userId,
    sessionId: conv.sessionId,
    user: userInfo,
    messages: conv.messages,
  });
}

// حذف یک مکالمه
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const { id } = await ctx.params;
  await prisma.chatConversation.delete({ where: { id } });
  return NextResponse.json({ success: true });
}