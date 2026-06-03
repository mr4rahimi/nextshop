import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonBigInt } from "@/lib/api/json";

export const runtime = "nodejs";

type Body = {
  userId: string;
  productId: string;
  qty?: number;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const qty = Math.max(1, Math.min(99, body.qty ?? 1));

  if (!body.userId || !body.productId) {
    return NextResponse.json({ message: "userId and productId required" }, { status: 400 });
  }

  const product = await prisma.product.findFirst({
    where: { id: body.productId, isActive: true },
    include: {
      assembledProduct: { include: { components: true } },
    },
  });

  if (!product) return NextResponse.json({ message: "Product not found" }, { status: 404 });

  const assembled = product.assembledProduct;
  const parts = assembled?.components ?? [];

  const txResult = await prisma.$transaction(async (tx) => {
    const cart = await tx.cart.upsert({
      where: { userId: body.userId },
      update: {},
      create: { userId: body.userId },
    });

    const assembledId = assembled?.id;

const cartItem = assembledId
  ? await tx.cartItem.upsert({
      where: {
        cartId_assembledProductId: {
          cartId: cart.id,
          assembledProductId: assembledId,
        },
      },
      update: { qty: { increment: qty } },
      create: {
        cartId: cart.id,
        productId: product.id,
        qty,
        assembledProductId: assembledId,
      },
    })
  : await tx.cartItem.upsert({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: product.id,
        },
      },
      update: { qty: { increment: qty } },
      create: {
        cartId: cart.id,
        productId: product.id,
        qty,
        assembledProductId: null,
      },
    });


  


    if (parts.length > 0) {
      for (const part of parts) {
        const reserveQty = qty * (part.qty ?? 1);

        const inv = await tx.inventoryOption.findUnique({
          where: { componentOptionId: part.componentOptionId },
        });

        if (!inv) {
          return {
            ok: false as const,
            message: "Inventory missing",
            componentOptionId: part.componentOptionId,
          };
        }

        const available = inv.stockQty - inv.reservedQty;
        if (available < reserveQty) {
          return {
            ok: false as const,
            message: "Out of stock",
            componentOptionId: part.componentOptionId,
            available,
          };
        }

        await tx.inventoryOption.update({
          where: { componentOptionId: part.componentOptionId },
          data: { reservedQty: { increment: reserveQty } },
        });
      }
    }

    return { ok: true as const, cartId: cart.id, cartItemId: cartItem.id };
  });

  if (!txResult.ok) {
    return NextResponse.json(txResult, { status: 409 });
  }

  return NextResponse.json(jsonBigInt(txResult));
}
