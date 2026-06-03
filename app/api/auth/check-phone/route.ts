import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// بررسی وجود شماره در سیستم
export async function POST(req: Request) {
  const { phone } = await req.json();

  if (!phone || !/^09[0-9]{9}$/.test(phone)) {
    return NextResponse.json({ error: "شماره موبایل نامعتبر است" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { phone },
    select: { id: true },
  });

  return NextResponse.json({ exists: !!user });
}