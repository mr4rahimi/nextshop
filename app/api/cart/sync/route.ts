import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "لاگین نشده" }, { status: 401 });

  const { items } = await req.json() as { items: { productId: string; qty: number }[] };
  if (!items?.length) return NextResponse.json({ success: true });

  let cart = await prisma.cart.findUnique({ where: { userId: user.id } });
  if (!cart) cart = await prisma.cart.create({ data: { userId: user.id } });

  for (const item of items) {
    await prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId: item.productId } },
      update: { qty: item.qty },
      create: { cartId: cart.id, productId: item.productId, qty: item.qty },
    });
  }

  return NextResponse.json({ success: true });
}
