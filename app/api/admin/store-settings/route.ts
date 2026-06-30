import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const s = await prisma.storeSettings.findUnique({ where: { id: "singleton" } });
  return NextResponse.json(s ?? {
    id: "singleton",
    cardNumber: null, cardHolder: null, cardBank: null, cardReceiptInfo: null,
    paymentGatewayActive: false, paymentGatewayProvider: null, paymentGatewayMerchant: null,
  });
}

export async function PUT(req: Request) {
  const data = await req.json();
  const row = {
    cardNumber:              data.cardNumber             ?? null,
    cardHolder:              data.cardHolder             ?? null,
    cardBank:                data.cardBank               ?? null,
    cardReceiptInfo:         data.cardReceiptInfo        ?? null,
    paymentGatewayActive:    data.paymentGatewayActive   ?? false,
    paymentGatewayProvider:  data.paymentGatewayProvider ?? null,
    paymentGatewayMerchant:  data.paymentGatewayMerchant ?? null,
    senderName:       data.senderName       ?? null,
    senderPhone:      data.senderPhone      ?? null,
    senderProvince:   data.senderProvince   ?? null,
    senderCity:       data.senderCity       ?? null,
    senderAddress:    data.senderAddress    ?? null,
    senderPostalCode: data.senderPostalCode ?? null,
    storeName:        data.storeName        ?? null,
    storeLogo:        data.storeLogo        ?? null,
  };
  const s = await prisma.storeSettings.upsert({
    where: { id: "singleton" },
    update: row,
    create: { id: "singleton", ...row },
  });
  return NextResponse.json(s);
}
