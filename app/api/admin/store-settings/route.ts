import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const s = await prisma.storeSettings.findUnique({ where: { id: "singleton" } });
  return NextResponse.json(s ?? {
    id: "singleton",
    cardNumber: null, cardHolder: null, cardBank: null, cardReceiptInfo: null,
    paymentGatewayActive: false, paymentGatewayMerchant: null,
  });
}

export async function PUT(req: Request) {
  const data = await req.json();
  const s = await prisma.storeSettings.upsert({
    where: { id: "singleton" },
    update: {
      cardNumber:             data.cardNumber ?? null,
      cardHolder:             data.cardHolder ?? null,
      cardBank:               data.cardBank ?? null,
      cardReceiptInfo:        data.cardReceiptInfo ?? null,
      paymentGatewayActive:   data.paymentGatewayActive ?? false,
      paymentGatewayMerchant: data.paymentGatewayMerchant ?? null,
    },
    create: {
      id: "singleton",
      cardNumber:             data.cardNumber ?? null,
      cardHolder:             data.cardHolder ?? null,
      cardBank:               data.cardBank ?? null,
      cardReceiptInfo:        data.cardReceiptInfo ?? null,
      paymentGatewayActive:   data.paymentGatewayActive ?? false,
      paymentGatewayMerchant: data.paymentGatewayMerchant ?? null,
    },
  });
  return NextResponse.json(s);
}
