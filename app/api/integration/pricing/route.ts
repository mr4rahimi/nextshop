import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pushPriceForMapping } from "@/lib/integration/core/pricing";

export const dynamic = "force-dynamic";

// GET /api/integration/pricing?page=1&perPage=30
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const perPage = Math.min(100, Math.max(10, Number(sp.get("perPage") ?? 30)));

  const where = { isActive: true };
  const [total, mappings] = await Promise.all([
    prisma.integMapping.count({ where }),
    prisma.integMapping.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { links: { where: { isActive: true } } },
    }),
  ]);

  const shopIds = mappings.flatMap((m) => m.links.filter((l) => l.platformCode === "shop").map((l) => l.externalId));
  const shopProducts = shopIds.length
    ? await prisma.product.findMany({ where: { id: { in: shopIds } }, select: { id: true, title: true, price: true } })
    : [];
  const shopMap = new Map(shopProducts.map((p) => [p.id, p]));

  const items = mappings.map((m) => ({
    id: m.id,
    stock: m.stock,
    purchasePriceSource: m.purchasePriceSource,
    purchasePrice: m.purchasePrice,
    syncPriceEnabled: m.syncPriceEnabled,
    lastPriceSyncAt: m.lastPriceSyncAt,
    links: m.links.map((l) => ({
      platformCode: l.platformCode,
      externalId: l.externalId,
      externalTitle: l.externalTitle,
      shopProduct: l.platformCode === "shop" ? shopMap.get(l.externalId) ?? null : null,
    })),
  }));

  return NextResponse.json({ total, page, perPage, items });
}

// PATCH — تنظیم منبع قیمت خرید / قیمت دستی / فعال‌سازی سینک قیمت
// body: { mappingId, purchasePriceSource?, purchasePrice?, syncPriceEnabled? }
export async function PATCH(req: NextRequest) {
  const body = await req.json() as {
    mappingId: string;
    purchasePriceSource?: "HESABAN" | "MANUAL";
    purchasePrice?: number | null;
    syncPriceEnabled?: boolean;
  };

  if (!body.mappingId) return NextResponse.json({ error: "mappingId الزامی است" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (body.purchasePriceSource !== undefined) data.purchasePriceSource = body.purchasePriceSource;
  if (body.purchasePrice !== undefined) data.purchasePrice = body.purchasePrice;
  if (body.syncPriceEnabled !== undefined) data.syncPriceEnabled = body.syncPriceEnabled;

  const mapping = await prisma.integMapping.update({ where: { id: body.mappingId }, data });

  // قیمت خرید دستی باید همان لحظه به فروشگاه و بازارگاه‌ها برسد. قبلاً فقط در
  // دیتابیس می‌نشست و تا وقتی کسی دکمه‌ی «همگام‌سازی قیمت» حسابان را نمی‌زد
  // هیچ پلتفرمی قیمت جدید را نمی‌دید — و آن دکمه هم زمان‌بندی خودکار ندارد.
  const shouldPush =
    body.purchasePrice !== undefined ||
    body.purchasePriceSource !== undefined ||
    body.syncPriceEnabled === true;

  if (!shouldPush) return NextResponse.json({ ...mapping, pricePush: null });

  try {
    const pricePush = await pushPriceForMapping(mapping.id);
    return NextResponse.json({ ...mapping, pricePush });
  } catch (err) {
    // ذخیره انجام شده؛ شکست ارسال نباید ویرایش را برگرداند، ولی باید دیده شود.
    return NextResponse.json({
      ...mapping,
      pricePush:      null,
      pricePushError: err instanceof Error ? err.message : String(err),
    });
  }
}