import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { orderId } = await req.json();
  if (!orderId) return NextResponse.json({ error: "orderId الزامی است" }, { status: 400 });

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true, grandTotal: true, status: true },
  });

  if (!order) return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });
  if (order.userId !== user.id) return NextResponse.json({ error: "دسترسی مجاز نیست" }, { status: 403 });
  if (order.status !== "PENDING_PAYMENT") return NextResponse.json({ error: "این سفارش قابل پرداخت نیست" }, { status: 400 });

  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: { walletBalance: true },
  });

  const balance = userData?.walletBalance ?? 0n;
  const grandTotal = order.grandTotal;

  if (balance <= 0n) {
    return NextResponse.json({ error: "موجودی کیف پول کافی نیست" }, { status: 400 });
  }

  const payAmount = balance >= grandTotal ? grandTotal : balance;
  const remaining = grandTotal - payAmount;

  const txOperations: any[] = [
    prisma.user.update({
      where: { id: user.id },
      data: { walletBalance: { decrement: payAmount } },
    }),
    prisma.walletTransaction.create({
      data: {
        userId: user.id,
        amount: -payAmount,
        reason: `پرداخت سفارش ${order.id.slice(-8).toUpperCase()}`,
        meta: { orderId },
      },
    }),
    prisma.payment.create({
      data: {
        orderId,
        amount: payAmount,
        status: "SUCCEEDED",
        provider: "WALLET",
        providerRef: `wallet-${Date.now()}`,
      },
    }),
  ];

  // اگه کامل پرداخت شد، وضعیت سفارش رو آپدیت کن
  if (remaining === 0n) {
    txOperations.push(
      prisma.order.update({
        where: { id: orderId },
        data: { status: "PAID" },
      })
    );
  }

  await prisma.$transaction(txOperations);

  return NextResponse.json(serialize({
    success: true,
    paidAmount: payAmount,
    remaining,
    fullyPaid: remaining === 0n,
  }));
}