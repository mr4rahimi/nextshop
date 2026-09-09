import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { hashPassword } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

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
  const has = (k: string) => Object.prototype.hasOwnProperty.call(data, k);

  // ⚠️ فقط فیلدهایی نوشته می‌شوند که واقعاً در بدنه آمده‌اند. پیش‌تر یک
  // درخواست ناقص، نام و ایمیل را خالی می‌کرد و کاربر را فعال می‌کرد —
  // همان تله‌ای که یک بار روی محصولات هم خورده بودیم.
  const patch: Prisma.UserUpdateInput = {};
  if (has("firstName")) patch.firstName = data.firstName || null;
  if (has("lastName")) patch.lastName = data.lastName || null;
  if (has("email")) patch.email = data.email || null;
  if (has("isActive")) patch.isActive = data.isActive ?? true;
  if (data.role) patch.role = data.role;
  if (data.password) patch.passwordHash = await hashPassword(data.password);

  // نقش کارتابل — `null` یعنی «بدون نقش» که دسترسی کامل می‌دهد
  if (has("staffRoleId")) {
    patch.staffRole = data.staffRoleId
      ? { connect: { id: data.staffRoleId } }
      : { disconnect: true };
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: patch,
      select: {
        id: true, firstName: true, lastName: true, email: true, isActive: true,
        staffRoleId: true,
        staffRole: { select: { id: true, title: true } },
      },
    });
    return NextResponse.json(user);
  } catch (e) {
    // کاربرِ نبوده یا نقشِ نبوده باید ۴۰۴ بدهد، نه ۵۰۰ با ردِ پشته
    const code = (e as { code?: string }).code;
    if (code === "P2025") {
      return NextResponse.json({ error: "کاربر یا نقش پیدا نشد" }, { status: 404 });
    }
    const message = e instanceof Error ? e.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
