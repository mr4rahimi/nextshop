import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getLastConversation } from "@/lib/chat-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ isLoggedIn: false });
  }

  const url = new URL(req.url);
  const siteId = url.searchParams.get("siteId") || "";

  if (!siteId) {
    return NextResponse.json({ isLoggedIn: true, conversationId: null, messages: [] });
  }

  const conv = await getLastConversation({ userId: user.id, siteId });

  if (!conv) {
    return NextResponse.json({ isLoggedIn: true, conversationId: null, messages: [] });
  }

  return NextResponse.json({
    isLoggedIn: true,
    conversationId: conv.id,
    messages: conv.messages,
  });
}
