import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });

  const { id } = await ctx.params;
  const data = await req.json();

  // بررسی مالکیت
  const existing = await prisma.address.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "آدرس یافت نشد" }, { status: 404 });

  if (data.isDefault) {
    await prisma.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
  }

  const address = await prisma.address.update({
    where: { id },
    data: {
      title: data.title || null,
      receiver: data.receiver,
      phone: data.phone,
      province: data.province,
      city: data.city,
      addressLine: data.addressLine,
      postalCode: data.postalCode || null,
      isDefault: data.isDefault ?? false,
    },
  });
  return NextResponse.json(address);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });

  const { id } = await ctx.params;
  const existing = await prisma.address.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "آدرس یافت نشد" }, { status: 404 });

  await prisma.address.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
