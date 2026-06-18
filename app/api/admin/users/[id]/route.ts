import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { hashPassword } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, firstName: true, lastName: true, phone: true,
      email: true, avatarUrl: true, nationalCode: true,
      role: true, isActive: true, createdAt: true,
      addresses: { orderBy: { isDefault: "desc" } },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true, orderNumber: true, status: true,
          grandTotal: true, createdAt: true,
          _count: { select: { items: true } },
        },
      },
      walletTx: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, amount: true, reason: true, createdAt: true },
      },
      _count: { select: { orders: true, reviews: true, wishlist: true } },
    },
  });

  if (!user) return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });

  const walletBalance = await prisma.walletTransaction.aggregate({
    where: { userId: id },
    _sum: { amount: true },
  });

  return NextResponse.json(serialize({ ...user, walletBalance: walletBalance._sum.amount ?? BigInt(0) }));
}

export async function PUT(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const data = await _req.json();

  const user = await prisma.user.update({
    where: { id },
    data: {
      firstName: data.firstName || null,
      lastName:  data.lastName  || null,
      email:     data.email     || null,
      isActive:  data.isActive  ?? true,
      ...(data.role ? { role: data.role } : {}),
      ...(data.password ? { passwordHash: await hashPassword(data.password) } : {}),
    },
    select: { id: true, firstName: true, lastName: true, email: true, isActive: true },
  });

  return NextResponse.json(user);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
