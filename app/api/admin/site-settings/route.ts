import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const s = await prisma.storeSettings.findUnique({ where: { id: "singleton" } });
  return NextResponse.json(s ?? { id: "singleton" });
}

export async function PUT(req: Request) {
  const data = await req.json();

  const updateData: any = {
    storeName:       data.storeName       ?? null,
    storeLogo:       data.storeLogo       ?? null,
    siteFavicon:     data.siteFavicon     ?? null,
    siteDescription: data.siteDescription ?? null,
    siteKeywords:    data.siteKeywords    ?? null,
    siteEmail:       data.siteEmail       ?? null,
    sitePhone:       data.sitePhone       ?? null,
    siteAddress:     data.siteAddress     ?? null,
    socialInstagram: data.socialInstagram ?? null,
    socialTelegram:  data.socialTelegram  ?? null,
    socialWhatsapp:  data.socialWhatsapp  ?? null,
    socialTwitter:   data.socialTwitter   ?? null,
    footerText:      data.footerText      ?? null,
    maintenanceMode: data.maintenanceMode ?? false,
    enamadCode:      data.enamadCode      ?? null,
    samanCode:       data.samanCode       ?? null,
    trustBadge3:     data.trustBadge3     ?? null,
    trustBadge4:     data.trustBadge4     ?? null,
  };

  // فیلدهای پرداخت/ارسال هم حفظ بشن اگه ارسال شدن
  if (data.cardNumber    !== undefined) updateData.cardNumber    = data.cardNumber    ?? null;
  if (data.cardHolder    !== undefined) updateData.cardHolder    = data.cardHolder    ?? null;
  if (data.cardBank      !== undefined) updateData.cardBank      = data.cardBank      ?? null;
  if (data.senderName    !== undefined) updateData.senderName    = data.senderName    ?? null;
  if (data.senderPhone   !== undefined) updateData.senderPhone   = data.senderPhone   ?? null;
  if (data.senderAddress !== undefined) updateData.senderAddress = data.senderAddress ?? null;
  // SMS settings
  if (data.smsEnabled      !== undefined) updateData.smsEnabled      = data.smsEnabled      ?? false;
  if (data.smsApiKey       !== undefined) updateData.smsApiKey       = data.smsApiKey       ?? null;
  if (data.smsLineNumber   !== undefined) updateData.smsLineNumber   = data.smsLineNumber   ?? null;
  if (data.smsPatternOtp         !== undefined) updateData.smsPatternOtp         = data.smsPatternOtp         ?? null;
  if (data.smsPatternOrderNew    !== undefined) updateData.smsPatternOrderNew    = data.smsPatternOrderNew    ?? null;
  if (data.smsPatternOrderPaid   !== undefined) updateData.smsPatternOrderPaid   = data.smsPatternOrderPaid   ?? null;
  if (data.smsPatternOrderConfirm !== undefined) updateData.smsPatternOrderConfirm = data.smsPatternOrderConfirm ?? null;
  if (data.smsPatternOrderPrepare !== undefined) updateData.smsPatternOrderPrepare = data.smsPatternOrderPrepare ?? null;
  if (data.smsPatternOrderPack   !== undefined) updateData.smsPatternOrderPack   = data.smsPatternOrderPack   ?? null;
  if (data.smsPatternOrderSent   !== undefined) updateData.smsPatternOrderSent   = data.smsPatternOrderSent   ?? null;
  if (data.smsPatternOrderDelivered !== undefined) updateData.smsPatternOrderDelivered = data.smsPatternOrderDelivered ?? null;
  if (data.smsPatternOrderDone   !== undefined) updateData.smsPatternOrderDone   = data.smsPatternOrderDone   ?? null;
  if (data.smsPatternOrderCancel !== undefined) updateData.smsPatternOrderCancel = data.smsPatternOrderCancel ?? null;
  // Wallet
  if (data.walletEnabled !== undefined) updateData.walletEnabled = data.walletEnabled ?? false;

  const s = await prisma.storeSettings.upsert({
    where: { id: "singleton" },
    update: updateData,
    create: { id: "singleton", ...updateData },
  });
  return NextResponse.json(s);
}
