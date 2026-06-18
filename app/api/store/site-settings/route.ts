import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const s = await prisma.storeSettings.findUnique({ where: { id: "singleton" } });
  return NextResponse.json({
    storeName:       s?.storeName       || null,
    storeLogo:       s?.storeLogo       ?? null,
    siteFavicon:     s?.siteFavicon     ?? null,
    siteDescription: s?.siteDescription ?? null,
    siteEmail:       s?.siteEmail       ?? null,
    sitePhone:       s?.sitePhone       ?? null,
    socialInstagram: s?.socialInstagram ?? null,
    socialTelegram:  s?.socialTelegram  ?? null,
    socialWhatsapp:  s?.socialWhatsapp  ?? null,
    footerText:      s?.footerText      ?? null,
    maintenanceMode: s?.maintenanceMode ?? false,
  });
}
