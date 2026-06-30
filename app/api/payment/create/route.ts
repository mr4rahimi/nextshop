import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });

  const { orderId } = await req.json();
  if (!orderId) return NextResponse.json({ error: "شناسه سفارش الزامی است" }, { status: 400 });

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: user.id },
    select: { id: true, grandTotal: true, status: true },
  });

  if (!order) return NextResponse.json({ error: "سفارش یافت نشد" }, { status: 404 });
  if (order.status !== "PENDING_PAYMENT")
    return NextResponse.json({ error: "این سفارش قابل پرداخت نیست" }, { status: 400 });

  const settings = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: {
      paymentGatewayActive: true,
      paymentGatewayProvider: true,
      paymentGatewayMerchant: true,
      paymentGatewaySandbox: true,
    },
  });

  if (!settings?.paymentGatewayActive)
    return NextResponse.json({ error: "درگاه پرداخت غیرفعال است" }, { status: 400 });

  const isSandbox = settings.paymentGatewaySandbox ?? false;
  const pin = isSandbox ? "sandbox" : settings.paymentGatewayMerchant;

  if (!pin)
    return NextResponse.json({ error: "کد پین درگاه تنظیم نشده است" }, { status: 400 });

  const origin = req.headers.get("origin") ?? "";
  const callbackUrl = `${origin}/api/payment/callback`;
  const amount = Number(order.grandTotal);

  const res = await fetch("https://panel.aqayepardakht.ir/api/v2/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pin,
      amount,
      callback: callbackUrl,
      callback_method: "GET",
      invoice_id: order.id,
    }),
  });

  const data = await res.json();

  if (data.status !== "success") {
    return NextResponse.json({ error: `خطای درگاه پرداخت (${data.code})` }, { status: 400 });
  }

  const redirectUrl = isSandbox
    ? `https://panel.aqayepardakht.ir/startpay/sandbox/${data.transid}`
    : `https://panel.aqayepardakht.ir/startpay/${data.transid}`;

  return NextResponse.json({ redirectUrl });
}
