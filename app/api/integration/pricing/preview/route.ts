import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { previewPricesForMappings } from "@/lib/integration/core/price-preview";

export const dynamic = "force-dynamic";

/**
 * GET /api/integration/pricing/preview?mappingId=...
 *
 * قیمت نمایشی یک محصول روی هر پلتفرم، طبق قوانین قیمت همان پلتفرم.
 * **فقط خواندنی** — پاپ‌آپ «قیمت نهایی در پلتفرم‌ها» از این می‌خواند و هیچ
 * ارسالی به بازارگاه‌ها انجام نمی‌دهد.
 */
export async function GET(req: NextRequest) {
  const mappingId = req.nextUrl.searchParams.get("mappingId");
  if (!mappingId) {
    return NextResponse.json({ error: "mappingId الزامی است" }, { status: 400 });
  }

  const previews = await previewPricesForMappings([mappingId]);
  const preview = previews.get(mappingId);
  if (!preview) {
    return NextResponse.json({ error: "نگاشت یافت نشد" }, { status: 404 });
  }

  // نام فارسی پلتفرم‌ها، فقط برای نمایش در پاپ‌آپ
  const platforms = await prisma.integPlatform.findMany({ select: { code: true, name: true } });
  const nameOf = new Map(platforms.map((p) => [p.code, p.name]));

  return NextResponse.json({
    purchasePrice: preview.purchasePrice,
    stock:         preview.stock,
    platforms:     preview.platforms.map((p) => ({
      ...p,
      platformName: nameOf.get(p.platformCode) ?? p.platformCode,
    })),
  });
}
