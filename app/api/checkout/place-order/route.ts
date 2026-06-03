import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonBigInt } from "@/lib/api/json";

export const runtime = "nodejs";

type Body = {
  userId: string;
  addressId?: string | null;
};

function makeOrderNumber() {
  return "ORD-" + Date.now().toString(36).toUpperCase();
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  if (!body.userId) return NextResponse.json({ message: "userId required" }, { status: 400 });

  const cart = await prisma.cart.findFirst({
    where: { userId: body.userId },
    include: {
      items: {
        include: {
          product: true,
          assembled: { include: { components: true } },
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    return NextResponse.json({ message: "Cart is empty" }, { status: 400 });
  }

  const orderNumber = makeOrderNumber();

  const result = await prisma.$transaction(async (tx) => {
    const itemsTotal = cart.items.reduce((sum, it) => {
      const unit = it.product.salePrice ?? it.product.price;
      return sum + unit * BigInt(it.qty);
    }, BigInt(0));

    // MVP: فعلاً هزینه ارسال/تخفیف = 0
    const shippingFee = BigInt(0);
    const discountTotal = BigInt(0);
    const grandTotal = itemsTotal + shippingFee - discountTotal;

    const order = await tx.order.create({
      data: {
        userId: body.userId,
        addressId: body.addressId ?? null,
        status: "PENDING_PAYMENT",
        orderNumber,

        itemsTotal,
        shippingFee,
        discountTotal,
        grandTotal,
      },
    });

    await tx.orderItem.createMany({
      data: cart.items.map((it) => {
        return {
          orderId: order.id,
          productId: it.productId,
          qty: it.qty,

          unitPrice: it.product.price,
          unitSalePrice: it.product.salePrice ?? null,

          titleSnapshot: it.product.title,
          skuSnapshot: null,
        };
      }),
    });

    // مصرف موجودی فقط برای assembled
    for (const it of cart.items) {
      const assembled = it.assembled;
      if (!assembled) continue;

      for (const part of assembled.components) {
        const used = it.qty * (part.qty ?? 1);

        await tx.inventoryOption.update({
          where: { componentOptionId: part.componentOptionId },
          data: {
            reservedQty: { decrement: used },
            stockQty: { decrement: used },
          },
        });
      }
    }

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return { orderId: order.id, orderNumber, grandTotal };
  });

  return NextResponse.json(jsonBigInt({ ok: true, ...result }));
}
