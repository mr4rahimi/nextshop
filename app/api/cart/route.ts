import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ items: [] });

  const cart = await prisma.cart.findUnique({
    where: { userId: user.id },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true, title: true, slug: true,
              price: true, salePrice: true,
              mainImage: true, isActive: true,
              images: { take: 1, select: { url: true } },
            },
          },
        },
      },
    },
  });

  return NextResponse.json(serialize(cart?.items ?? []));
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "لاگین نشده" }, { status: 401 });

  const { productId, qty } = await req.json();
  if (!productId || qty < 1) return NextResponse.json({ error: "اطلاعات نامعتبر" }, { status: 400 });

  let cart = await prisma.cart.findUnique({ where: { userId: user.id } });
  if (!cart) cart = await prisma.cart.create({ data: { userId: user.id } });

  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId: cart.id, productId } },
    update: { qty },
    create: { cartId: cart.id, productId, qty },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "لاگین نشده" }, { status: 401 });

  const cart = await prisma.cart.findUnique({ where: { userId: user.id } });
  if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

  return NextResponse.json({ success: true });
}
