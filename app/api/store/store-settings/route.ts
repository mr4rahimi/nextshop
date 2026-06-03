import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const s = await prisma.storeSettings.findUnique({ where: { id: "singleton" } });
  // فقط اطلاعات عمومی برگردان (نه merchant key)
  return NextResponse.json({
    cardNumber:      s?.cardNumber ?? null,
    cardHolder:      s?.cardHolder ?? null,
    cardBank:        s?.cardBank ?? null,
    cardReceiptInfo: s?.cardReceiptInfo ?? null,
    paymentGatewayActive: s?.paymentGatewayActive ?? false,
  });
}
