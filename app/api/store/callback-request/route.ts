import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";

function isValidPhone(phone: string): boolean {
  return /^(09|\+989|00989)\d{9}$|^09\d{9}$/.test(phone.trim());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const phone: string = (body.phone ?? "").trim();
  const siteId: string = (body.siteId ?? "").trim();
  const conversationId: string | null = body.conversationId ?? null;

  if (!phone || !isValidPhone(phone)) {
    return NextResponse.json({ error: "شماره تماس معتبر نیست" }, { status: 400 });
  }

  const user = await getAuthUser();

  await prisma.callbackRequest.create({
    data: {
      phone,
      siteId: siteId || null,
      conversationId: conversationId || null,
      userId: user?.id ?? null,
      status: "pending",
    },
  });

  return NextResponse.json({ success: true });
}
