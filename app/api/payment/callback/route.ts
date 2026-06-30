import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const transid        = url.searchParams.get("transid");
  const status         = url.searchParams.get("status");
  const orderId        = url.searchParams.get("invoice_id");
  const trackingNumber = url.searchParams.get("tracking_number");

  const base = `${url.protocol}//${url.host}`;

  if (!orderId) return NextResponse.redirect(`${base}/`);

  if (status !== "1") {
    return NextResponse.redirect(`${base}/checkout/failed/${orderId}`);
  }

  if (!transid) {
    return NextResponse.redirect(`${base}/checkout/failed/${orderId}`);
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, grandTotal: true, status: true },
  });

  if (!order) return NextResponse.redirect(`${base}/checkout/failed/${orderId}`);

  // Already processed (idempotent)
  if (order.status !== "PENDING_PAYMENT") {
    return NextResponse.redirect(`${base}/checkout/success/${orderId}`);
  }

  const settings = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: { paymentGatewayMerchant: true, paymentGatewaySandbox: true },
  });

  const isSandbox = settings?.paymentGatewaySandbox ?? false;
  const pin = isSandbox ? "sandbox" : settings?.paymentGatewayMerchant;

  if (!pin) {
    return NextResponse.redirect(`${base}/checkout/failed/${orderId}`);
  }

  try {
    const verifyRes = await fetch("https://panel.aqayepardakht.ir/api/v2/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin,
        amount: Number(order.grandTotal),
        transid,
      }),
    });

    const verifyData = await verifyRes.json();
    const code = String(verifyData.code);

    if (verifyData.status === "success" && code === "1") {
      await prisma.$transaction([
        prisma.order.update({
          where: { id: orderId },
          data: { status: "PAID" },
        }),
        prisma.payment.updateMany({
          where: { orderId, status: "PENDING" },
          data: {
            status: "SUCCEEDED",
            providerRef: trackingNumber ?? transid,
          },
        }),
      ]);
      return NextResponse.redirect(`${base}/checkout/success/${orderId}`);
    }

    // code "2" = already verified before (treat as success)
    if (code === "2") {
      return NextResponse.redirect(`${base}/checkout/success/${orderId}`);
    }
  } catch {
    // network or parse error
  }

  return NextResponse.redirect(`${base}/checkout/failed/${orderId}`);
}
