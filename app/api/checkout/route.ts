import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { decrementMappingStockForOrder } from "@/lib/integration/core/inventory";

export const runtime = "nodejs";

function generateOrderNumber(): string {
  const prefix = "MN";
  const num = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}-${num}`;
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });

  const { addressId, shippingMethodId, paymentMethod, items, useWallet } = await req.json();

  if (!addressId || !shippingMethodId || !items?.length)
    return NextResponse.json({ error: "اطلاعات ناقص است" }, { status: 400 });

  const address = await prisma.address.findFirst({ where: { id: addressId, userId: user.id } });
  if (!address) return NextResponse.json({ error: "آدرس نامعتبر است" }, { status: 400 });

  const shipping = await prisma.shippingMethod.findUnique({ where: { id: shippingMethodId } });
  if (!shipping || !shipping.isActive) return NextResponse.json({ error: "روش ارسال نامعتبر است" }, { status: 400 });

  const productIds = items.map((i: any) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    select: { id: true, title: true, price: true, salePrice: true },
  });

  if (products.length !== productIds.length)
    return NextResponse.json({ error: "یک یا چند محصول در دسترس نیست" }, { status: 400 });

  let itemsTotal = BigInt(0);
  const orderItems = items.map((i: any) => {
    const p = products.find(pr => pr.id === i.productId)!;
    const unitPrice = p.price;
    const unitSalePrice = p.salePrice;
    const linePrice = (unitSalePrice ?? unitPrice) * BigInt(i.qty);
    itemsTotal += linePrice;
    return {
      productId: p.id,
      qty: i.qty,
      unitPrice,
      unitSalePrice,
      titleSnapshot: p.title,
    };
  });

  const shippingFee = shipping.fee;
  const grandTotal = itemsTotal + shippingFee;

  let walletDiscount = BigInt(0);
  let finalGrandTotal = grandTotal;

  if (useWallet) {
    const settings = await prisma.storeSettings.findUnique({
      where: { id: "singleton" },
      select: { walletEnabled: true },
    });

    if (settings?.walletEnabled) {
      const userData = await prisma.user.findUnique({
        where: { id: user.id },
        select: { walletBalance: true },
      });
      const balance = userData?.walletBalance ?? 0n;
      if (balance > 0n) {
        walletDiscount = balance >= grandTotal ? grandTotal : balance;
        finalGrandTotal = grandTotal - walletDiscount;
      }
    }
  }

 
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        addressId,
        orderNumber: generateOrderNumber(),
        status: walletDiscount > 0n && finalGrandTotal === 0n ? "PAID" : "PENDING_PAYMENT",
        itemsTotal,
        shippingFee,
        discountTotal: walletDiscount,
        grandTotal: finalGrandTotal,
        items: { create: orderItems },
        payments: {
          create: [
           
            ...(finalGrandTotal > 0n ? [{
              amount: finalGrandTotal,
              status: "PENDING" as const,
              provider: paymentMethod === "online" ? "gateway" : "card_transfer",
            }] : []),
        
            ...(walletDiscount > 0n ? [{
              amount: walletDiscount,
              status: "SUCCEEDED" as const,
              provider: "WALLET",
              providerRef: `wallet-${Date.now()}`,
            }] : []),
          ],
        },
      },
    });

  
  if (walletDiscount > 0n) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { walletBalance: { decrement: walletDiscount } },
      }),
      prisma.walletTransaction.create({
        data: {
          userId: user.id,
          amount: -walletDiscount,
          reason: `پرداخت سفارش ${order.orderNumber}`,
          meta: { orderId: order.id },
        },
      }),
    ]);
  }

  const cart = await prisma.cart.findUnique({ where: { userId: user.id } });
  if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

   await Promise.all(
     orderItems.map((item: { productId: string; qty: number }) =>
       prisma.product.updateMany({
         where: { id: item.productId, trackStock: true, stock: { gt: 0 } },
         data: { stock: { decrement: item.qty } },
       })
     )
   );

  return NextResponse.json(serialize({ orderId: order.id, orderNumber: order.orderNumber }));
}

await Promise.all(
     orderItems.map((item: { productId: string; qty: number }) =>
       prisma.product.updateMany({
         where: { id: item.productId, trackStock: true, stock: { gt: 0 } },
         data: { stock: { decrement: item.qty } },
       })
     )
   );


  await Promise.all(
    orderItems.map((item: { productId: string; qty: number }) =>
      decrementMappingStockForOrder("shop", item.productId, item.qty).catch(() => {})
    )
  ).catch(() => {});

  return NextResponse.json(serialize({ orderId: order.id, orderNumber: order.orderNumber }));