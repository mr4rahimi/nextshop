import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { sendOrderSms, OrderSmsEvent } from "@/lib/sms";

export const runtime = "nodejs";


const STATUS_TO_SMS_EVENT: Record<string, OrderSmsEvent> = {
  PAID:            "orderPaid",
  CONFIRMED:       "orderConfirm",
  PROCESSING:      "orderPrepare",
  PACKAGING:       "orderPack",
  SHIPPED:         "orderSent",
  DELIVERED:       "orderDelivered",
  COMPLETED:       "orderDone",
  CANCELED:        "orderCancel",
};

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true, firstName: true, lastName: true,
          phone: true, email: true, avatarUrl: true,
        },
      },
      address: true,
      items: {
        include: {
          product: {
            select: {
              id: true, title: true, slug: true,
              mainImage: true,
              images: { take: 1, select: { url: true } },
            },
          },
        },
      },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!order) return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });

  const storeSettings = await prisma.storeSettings.findUnique({ where: { id: "singleton" } });

  return NextResponse.json(serialize({ order, storeSettings }));
}

export async function PUT(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const data = await _req.json();

  
  const prevOrder = await prisma.order.findUnique({
    where: { id },
    select: {
      status: true,
      items: { select: { productId: true, qty: true } },
      user: { select: { phone: true, firstName: true, lastName: true } },
    },
  });

  const order = await prisma.order.update({
    where: { id },
    data: {
      status:       data.status,
      trackingCode: data.trackingCode ?? null,
      note:         data.note ?? null,
    },
    select: {
      id: true, status: true, trackingCode: true, note: true, updatedAt: true,
    },
  });


  const shouldDeductStock =
   prevOrder &&
   ["PENDING_PAYMENT", "PAID"].includes(prevOrder.status) &&
   data.status === "CONFIRMED";

  if (shouldDeductStock && prevOrder?.items.length > 0) {
    await Promise.all(
      prevOrder.items.map(item =>
        prisma.product.updateMany({
          where: { id: item.productId, trackStock: true, stock: { gt: 0 } },
          data: { stock: { decrement: item.qty } },
        })
      )
    );
  }

 
  if (prevOrder && data.status && data.status !== prevOrder.status) {
    const event = STATUS_TO_SMS_EVENT[data.status];
    const phone = prevOrder.user?.phone;

    if (event && phone) {
      const name = [prevOrder.user?.firstName, prevOrder.user?.lastName]
        .filter(Boolean).join(" ") || phone;

      const attributes: Record<string, string> = {
        order_id: id.slice(-8).toUpperCase(),
        name,
      };

   
      if (data.trackingCode) {
        attributes.tracking = data.trackingCode;
      }

   
      sendOrderSms(phone, event, attributes).catch(err =>
        console.error("[SMS] خطا در ارسال پیامک سفارش:", err)
      );
    }
  }

  return NextResponse.json(serialize(order));
}