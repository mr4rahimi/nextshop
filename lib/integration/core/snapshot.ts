import { prisma } from "@/lib/prisma";
import type { PriceDiscount } from "@/lib/integration/types";
import { applyDiscount } from "@/lib/integration/types";

// ── تازه‌سازی snapshot محصول پلتفرم بعد از یک ارسال موفق ─────────────
//
// چرا لازم است: `IntegPlatformProduct` تنها در «دریافت محصولات» نوشته می‌شد.
// یعنی بعد از یک SYNC_PRICE موفق، snapshot هنوز قیمت قدیمی را داشت.
// اسنپ‌شاپ در هر PATCH موجودی، قیمت را هم اجباری می‌خواهد و آداپتور آن را از
// همین snapshot برمی‌داشت — پس اولین سینک موجودیِ بعدی، قیمت تازه‌ارسال‌شده را
// به مقدار قدیمی برمی‌گرداند و کاربر می‌دید «قیمت‌ها بروز نمی‌شود».
//
// این ردیف‌ها فقط کش محلی‌اند؛ اگر محصول در snapshot نباشد چیزی ساخته نمی‌شود
// (ساختن ردیف ناقص، auto-match را با داده‌ی جعلی آلوده می‌کند).

// `discount === undefined` یعنی «فرستنده تخفیف را تعیین نکرده و آداپتور خودش از
// snapshot خوانده» — پس اینجا هم باید همان تخفیف حفظ شود، نه اینکه پاک شود.
// `null` صریحاً یعنی «تخفیفی ندارد».
export async function recordPushedPrice(
  platformCode: string,
  platformProductId: string,
  basePrice: number,
  discount?: PriceDiscount | null,
): Promise<void> {
  let resolved: PriceDiscount | null | undefined = discount;

  if (resolved === undefined) {
    const snap = await prisma.integPlatformProduct.findUnique({
      where:  { platformCode_platformProductId: { platformCode, platformProductId } },
      select: {
        originalPrice: true, discountPercent: true,
        discountStartsAt: true, discountEndsAt: true, discountStock: true,
      },
    });
    resolved =
      snap && snap.discountPercent != null && snap.discountPercent > 0 && snap.originalPrice != null
        ? {
            percent:  snap.discountPercent,
            startsAt: snap.discountStartsAt,
            endsAt:   snap.discountEndsAt,
            stock:    snap.discountStock,
          }
        : null;
  }

  const { original, effective } = applyDiscount(basePrice, resolved);
  const hasDiscount = !!resolved && resolved.percent > 0 && effective < original;

  await prisma.integPlatformProduct.updateMany({
    where: { platformCode, platformProductId },
    data: {
      // قرارداد ستون‌ها همان «دریافت محصولات» است:
      // price = قیمت مؤثر، originalPrice = قیمت پیش از تخفیف (فقط وقتی تخفیف هست)
      price:            effective,
      originalPrice:    hasDiscount ? original : null,
      discountPercent:  hasDiscount ? resolved!.percent : null,
      discountStartsAt: hasDiscount ? resolved!.startsAt ?? null : null,
      discountEndsAt:   hasDiscount ? resolved!.endsAt   ?? null : null,
      discountStock:    hasDiscount ? resolved!.stock    ?? null : null,
      discountSynced:   true,
      updatedAt:        new Date(),
    },
  });
}

export async function recordPushedStock(
  platformCode: string,
  platformProductId: string,
  stock: number,
): Promise<void> {
  await prisma.integPlatformProduct.updateMany({
    where: { platformCode, platformProductId },
    data:  { stock, updatedAt: new Date() },
  });
}
