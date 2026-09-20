import { prisma } from "@/lib/prisma";
import { applyDiscount } from "@/lib/integration/types";
import { calculatePrice, loadActiveRules, pickRule } from "./pricing";
import { resolveDiscountsForPush, type ResolvedDiscount } from "./discount";

/**
 * پیش‌نمایش «قیمت نمایشی روی هر پلتفرم» — بدون هیچ ارسالی.
 *
 * همان مسیری که `pushMappingPrice` برای محاسبه طی می‌کند، ولی فقط می‌خوانَد:
 * قانون قیمت منطبق پیدا می‌شود، قیمت از روی قیمت خرید و موجودی ساخته می‌شود و
 * تخفیف فعال هم رویش می‌نشیند. هدف این است که کاربر پیش از ارسال بداند مشتری
 * در باسلام یا اسنپ‌شاپ دقیقاً چه عددی می‌بیند.
 *
 * **این ماژول عمداً هیچ چیزی نمی‌نویسد.** هر تغییری که باعث نوشتن شود، صفحه‌ی
 * تخفیف‌ها را به یک ارسال ناخواسته تبدیل می‌کند.
 */

export interface PlatformPricePreview {
  platformCode: string;
  /** قانونی که اعمال شد — برای اینکه کاربر بفهمد عدد از کجا آمده */
  ruleName: string | null;
  /** قیمت نمایشی طبق قوانین، بدون تخفیف (تومان) */
  price: number | null;
  /** قیمت نمایشی با تخفیف فعال (تومان) — بدون تخفیف برابر `price` است */
  effective: number | null;
  /** درصد تخفیفی که همین حالا فعال است */
  discountPercent: number | null;
  /** تخفیف از پنل ما می‌آید یا از کش خود پلتفرم */
  discountSource: "MANAGED" | "PLATFORM" | "NONE" | "UNKNOWN";
  /** اگر محاسبه ممکن نبود، دلیلش به فارسی */
  reason: string | null;
}

export interface MappingPricePreview {
  mappingId: string;
  purchasePrice: number | null;
  stock: number;
  platforms: PlatformPricePreview[];
}

/** پلتفرم‌هایی که قیمت‌شان از قوانین ساخته می‌شود ولی تخفیف بازارگاهی ندارند. */
const NO_MARKETPLACE_DISCOUNT = new Set(["shop"]);

/**
 * پیش‌نمایش قیمت چند نگاشت با هم.
 *
 * تعداد کوئری‌ها مستقل از تعداد نگاشت‌هاست: قوانین، لینک‌ها، محصولات فروشگاه و
 * پلتفرم‌ها هرکدام یک کوئری، و تخفیف‌ها یکی به ازای هر پلتفرم.
 */
export async function previewPricesForMappings(
  mappingIds: string[],
  now: Date = new Date(),
): Promise<Map<string, MappingPricePreview>> {
  const out = new Map<string, MappingPricePreview>();
  if (!mappingIds.length) return out;

  const ids = [...new Set(mappingIds)];

  const [mappings, rules, platforms] = await Promise.all([
    prisma.integMapping.findMany({
      where:   { id: { in: ids } },
      select:  {
        id: true, purchasePrice: true, stock: true,
        links: {
          where:  { isActive: true },
          select: { platformCode: true, externalId: true, discountManaged: true },
        },
      },
    }),
    loadActiveRules(),
    prisma.integPlatform.findMany({ select: { code: true, type: true } }),
  ]);

  // به حسابداری قیمت پوش نمی‌شود، پس پیش‌نمایشی هم ندارد
  const accounting = new Set(
    platforms.filter((p) => p.type === "ACCOUNTING").map((p) => p.code),
  );

  // دسته‌ی محصولات فروشگاه، چون دامنه‌ی قانون روی دسته و برند بسته می‌شود
  const shopIds = mappings.flatMap((m) =>
    m.links.filter((l) => l.platformCode === "shop").map((l) => l.externalId));
  const shopProducts = shopIds.length
    ? await prisma.product.findMany({
        where:  { id: { in: shopIds } },
        select: { id: true, categoryId: true, brandId: true },
      })
    : [];
  const shopMap = new Map(shopProducts.map((p) => [p.id, p]));

  // تخفیف‌ها یک‌بار به ازای هر پلتفرم — نه یک‌بار به ازای هر لینک
  const byPlatform = new Map<string, string[]>();
  for (const m of mappings) {
    for (const l of m.links) {
      if (accounting.has(l.platformCode) || NO_MARKETPLACE_DISCOUNT.has(l.platformCode)) continue;
      const list = byPlatform.get(l.platformCode) ?? [];
      list.push(l.externalId);
      byPlatform.set(l.platformCode, list);
    }
  }
  const discountMaps = new Map<string, Map<string, ResolvedDiscount>>();
  await Promise.all(
    [...byPlatform.entries()].map(async ([code, externalIds]) => {
      discountMaps.set(code, await resolveDiscountsForPush(code, externalIds, now));
    }),
  );

  for (const m of mappings) {
    const shopLink = m.links.find((l) => l.platformCode === "shop");
    const shopProduct = shopLink ? shopMap.get(shopLink.externalId) ?? null : null;

    const platformPreviews: PlatformPricePreview[] = [];

    for (const link of m.links) {
      if (accounting.has(link.platformCode)) continue;

      const base: PlatformPricePreview = {
        platformCode:    link.platformCode,
        ruleName:        null,
        price:           null,
        effective:       null,
        discountPercent: null,
        discountSource:  "NONE",
        reason:          null,
      };

      if (m.purchasePrice == null) {
        platformPreviews.push({ ...base, reason: "قیمت خرید ثبت نشده" });
        continue;
      }

      const rule = pickRule(rules, link.platformCode, shopProduct);
      if (!rule) {
        platformPreviews.push({ ...base, reason: "قانون قیمت فعالی برای این پلتفرم نیست" });
        continue;
      }

      const price = calculatePrice(rule, m.purchasePrice, m.stock);

      // فروشگاه خودش تخفیف بازارگاهی ندارد؛ قیمتش همان خروجی قانون است
      if (NO_MARKETPLACE_DISCOUNT.has(link.platformCode)) {
        platformPreviews.push({ ...base, ruleName: rule.name, price, effective: price });
        continue;
      }

      const resolved = discountMaps.get(link.platformCode)?.get(link.externalId);

      if (resolved === "UNKNOWN") {
        platformPreviews.push({
          ...base,
          ruleName:       rule.name,
          price,
          effective:      price,
          discountSource: "UNKNOWN",
          reason:         "وضعیت تخفیف این محصول نامشخص است — «تحت مدیریت پنل» خاموش است و کش پلتفرم خالی",
        });
        continue;
      }

      const discount = resolved ?? null;
      const { original, effective } = applyDiscount(price, discount);

      platformPreviews.push({
        ...base,
        ruleName:        rule.name,
        price:           original,
        effective,
        discountPercent: discount?.percent ?? null,
        // منبع تخفیف را از خود لینک می‌خوانیم؛ `resolveDiscountsForPush` فقط
        // نتیجه را می‌دهد و نمی‌گوید از پنل آمده یا از کش پلتفرم
        discountSource:  !discount ? "NONE" : link.discountManaged ? "MANAGED" : "PLATFORM",
      });
    }

    out.set(m.id, {
      mappingId:     m.id,
      purchasePrice: m.purchasePrice,
      stock:         m.stock,
      platforms:     platformPreviews,
    });
  }

  return out;
}
