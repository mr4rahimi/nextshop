import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const phone = url.searchParams.get("phone")?.trim();
  if (!phone) return NextResponse.json({ error: "phone الزامی است" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { phone },
    select: {
      id: true, firstName: true, lastName: true, phone: true,
      walletBalance: true,
      walletTx: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!user) return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
  return NextResponse.json(serialize(user));
}

export async function POST(req: Request) {
  const body = await req.json();
  const { userId, amount, reason, type } = body;

  if (!userId || !amount || !reason) {
    return NextResponse.json({ error: "اطلاعات ناقص" }, { status: 400 });
  }

  const delta = BigInt(Math.abs(Number(amount))) * (type === "decrease" ? -1n : 1n);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { walletBalance: true },
  });

  if (!user) return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });

  if (type === "decrease" && user.walletBalance + delta < 0n) {
    return NextResponse.json({ error: "موجودی کافی نیست" }, { status: 400 });
  }

  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { walletBalance: { increment: delta } },
      select: { id: true, walletBalance: true },
    }),
    prisma.walletTransaction.create({
      data: { userId, amount: delta, reason },
    }),
  ]);

  return NextResponse.json(serialize(updated));
}
