import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";

export const runtime = "nodejs";

export async function GET() {
  const [columns, settings, categories] = await Promise.all([
    prisma.footerColumn.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        items: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    prisma.storeSettings.findUnique({ where: { id: "singleton" } }),
    prisma.category.findMany({
      where: { isActive: true, parentId: null },
      take: 8,
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true, slug: true },
    }),
  ]);

  return NextResponse.json(serialize({
    columns,
    settings: {
      storeName:       settings?.storeName       ?? "مانا شاپ",
      storeLogo:       settings?.storeLogo       ?? null,
      siteDescription: settings?.siteDescription ?? null,
      siteEmail:       settings?.siteEmail       ?? null,
      sitePhone:       settings?.sitePhone       ?? null,
      siteAddress:     settings?.siteAddress     ?? null,
      footerText:      settings?.footerText      ?? null,
      socialInstagram: settings?.socialInstagram ?? null,
      socialTelegram:  settings?.socialTelegram  ?? null,
      socialWhatsapp:  settings?.socialWhatsapp  ?? null,
      socialTwitter:   settings?.socialTwitter   ?? null,
      enamadCode:      settings?.enamadCode      ?? null,
      samanCode:       settings?.samanCode       ?? null,
      trustBadge3:     settings?.trustBadge3     ?? null,
      trustBadge4:     settings?.trustBadge4     ?? null,
    },
    categories,
  }));
}
