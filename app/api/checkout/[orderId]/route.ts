import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });

  const { orderId } = await ctx.params;

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: user.id },
    include: {
      address: true,
      items: {
        include: {
          product: {
            select: { id: true, title: true, mainImage: true, images: { take: 1, select: { url: true } } },
          },
        },
      },
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!order) return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });

  const storeSettings = await prisma.storeSettings.findUnique({ where: { id: "singleton" } });

  return NextResponse.json(serialize({
    order,
    cardInfo: {
      cardNumber:      storeSettings?.cardNumber ?? null,
      cardHolder:      storeSettings?.cardHolder ?? null,
      cardBank:        storeSettings?.cardBank ?? null,
      cardReceiptInfo: storeSettings?.cardReceiptInfo ?? null,
    },
  }));
}
