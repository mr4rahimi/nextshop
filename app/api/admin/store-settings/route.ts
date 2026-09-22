import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

/**
 * ⚠️ `StoreSettings` فیلد `BigInt` دارد (`worklistLoyalMinSpent`) و
 * `NextResponse.json` روی BigInt خطا می‌دهد: «Do not know how to serialize
 * a BigInt». یعنی برگرداندنِ **کلِ ردیف** بدون `serialize` صفحه را با ۵۰۰
 * می‌شکند. این دقیقاً همان چیزی بود که صفحه‌ی تنظیمات سایت را از کار انداخت.
 *
 * هر وقت ستون BigInt تازه‌ای به این جدول اضافه شد، همین‌جا امن است — ولی
 * مسیری که ردیف را خام برمی‌گرداند باید `serialize` داشته باشد.
 */

export async function GET() {
  const s = await prisma.storeSettings.findUnique({ where: { id: "singleton" } });
  return NextResponse.json(serialize(s) ?? {
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
  return NextResponse.json(serialize(s));
}
