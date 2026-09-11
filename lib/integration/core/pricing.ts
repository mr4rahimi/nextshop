import { prisma } from "@/lib/prisma";
import type { IntegPriceRule, IntegPriceRuleTier } from "@prisma/client";
import { getAdapter } from "./adapter-registry";
import { decryptCredentials } from "./crypto";
import { writeLog } from "./log";
import { applyDiscount } from "@/lib/integration/types";
import { recordPushedPrice } from "./snapshot";
import { resolveDiscountForPush, recordDiscountPush, findDiscountWindowChanges } from "./discount";

type RuleWithTiers = IntegPriceRule & { tiers: IntegPriceRuleTier[] };

// ── محاسبه‌ی سود بر اساس موجودی (tier) ───────────────────────────────

function resolveMarginPercent(rule: RuleWithTiers, stock: number): number {
  const sorted = [...rule.tiers].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const tier of sorted) {
    const minOk = tier.minStock == null || stock >= tier.minStock;
    const maxOk = tier.maxStock == null || stock < tier.maxStock;
    if (minOk && maxOk) return tier.marginPercent;
  }
  return rule.marginPercent;
}

function costAmount(type: "FIXED" | "PERCENT", value: number, base: number): number {
  return type === "PERCENT" ? (value / 100) * base : value;
}

// ── محاسبه‌ی قیمت نهایی: هزینه‌ها اول، سود آخر ────────────────────────

export function calculatePrice(rule: RuleWithTiers, purchasePrice: number, stock: number): number {
  const margin = resolveMarginPercent(rule, stock);

  const feeAmount       = (rule.feePercent / 100) * purchasePrice;
  const shippingAmount  = costAmount(rule.shippingType,  rule.shippingValue,  purchasePrice);
  const packagingAmount = costAmount(rule.packagingType, rule.packagingValue, purchasePrice);
  const miscAmount      = costAmount(rule.miscType,      rule.miscValue,      purchasePrice);

  const subtotal = purchasePrice + feeAmount + shippingAmount + packagingAmount + miscAmount;
  const final    = subtotal * (1 + margin / 100);

  if (rule.roundTo && rule.roundTo > 0) {
    return Math.ceil(final / rule.roundTo) * rule.roundTo;
  }
  return Math.round(final);
}

// ── پیدا کردن اولین قانون فعال و منطبق برای یک پلتفرم/محصول ──────────

async function findApplicableRule(
  platformCode: string,
  shopProduct: { categoryId: string; brandId: string | null } | null,
): Promise<RuleWithTiers | null> {
  const rules = await prisma.integPriceRule.findMany({
    where:   { isActive: true },
    orderBy: { priority: "asc" },
    include: { tiers: true },
  });

  for (const rule of rules) {
    if (rule.targetPlatforms.length > 0 && !rule.targetPlatforms.includes(platformCode)) continue;

    if (rule.scopeCategoryIds.length > 0) {
      if (!shopProduct || !rule.scopeCategoryIds.includes(shopProduct.categoryId)) continue;
    }
    if (rule.scopeBrandIds.length > 0) {
      if (!shopProduct?.brandId || !rule.scopeBrandIds.includes(shopProduct.brandId)) continue;
    }

    return rule;
  }
  return null;
}

// ── Push قیمت محاسبه‌شده‌ی یک mapping به همه‌ی لینک‌های فعال ──────────

// آمار واقعی هر ارسال. بدون این، لاگ SYNC_ALL_PRICE حتی وقتی هیچ پلتفرمی
// قیمت نگرفته «موفق» ثبت می‌شد و خرابی یک ماه دیده نشد.
export interface PricePushResult {
  pushed:  number;
  failed:  number;
  skipped: number;
}

function emptyResult(): PricePushResult {
  return { pushed: 0, failed: 0, skipped: 0 };
}

async function pushMappingPrice(mapping: {
  id: string;
  purchasePrice: number | null;
  stock: number;
}): Promise<PricePushResult> {
  const tally = emptyResult();
  if (mapping.purchasePrice == null) return tally;

  const links = await prisma.integMappingLink.findMany({
    where: { mappingId: mapping.id, isActive: true },
  });

  const shopLink = links.find((l) => l.platformCode === "shop");
  const shopProduct = shopLink
    ? await prisma.product.findUnique({
        where:  { id: shopLink.externalId },
        select: { categoryId: true, brandId: true },
      })
    : null;

  for (const link of links) {
    const platform = await prisma.integPlatform.findUnique({ where: { code: link.platformCode } });
    if (platform?.type === "ACCOUNTING") { tally.skipped++; continue; } // به حسابداری قیمت پوش نمی‌کنیم

    const rule = await findApplicableRule(link.platformCode, shopProduct);
    if (!rule) {
      await writeLog({
        platformCode:  link.platformCode,
        operationType: "SYNC_PRICE",
        direction:     "OUTBOUND",
        entityType:    "PRICE",
        entityId:      link.externalId,
        status:        "ERROR",
        errorMessage:  "هیچ قانون قیمت فعالی برای این پلتفرم/محصول پیدا نشد",
      }).catch(() => {});
      tally.failed++;
      continue;
    }

    const price = calculatePrice(rule, mapping.purchasePrice, mapping.stock);

    if (link.platformCode === "shop") {
      await prisma.product.update({
        where: { id: link.externalId },
        data:  { price: BigInt(Math.round(price)) },
      }).catch(() => {});
      tally.pushed++;
      continue;
    }

    // تخفیفی که باید همراه قیمت جدید برود — لینک تحت مدیریت از پنل ما می‌آید،
    // لینک آزاد از کش پلتفرم. جزئیات در docs/integrations/discounts.md
    const loaded = await resolveDiscountForPush(link.platformCode, link.externalId);
    if (loaded === "UNKNOWN") {
      await writeLog({
        platformCode:  link.platformCode,
        operationType: "SYNC_PRICE",
        direction:     "OUTBOUND",
        entityType:    "PRICE",
        entityId:      link.externalId,
        status:        "ERROR",
        errorMessage:  "وضعیت تخفیف این محصول نامشخص است — این لینک «تحت مدیریت پنل» نیست و کش پلتفرم هم خالی است. یا «دریافت محصولات» را اجرا کنید یا از صفحه‌ی تخفیف‌ها مدیریت پنل را روشن کنید",
      }).catch(() => {});
      tally.failed++;
      continue;
    }
    const discount = loaded;

    const connection = await prisma.integConnection.findFirst({
      where: { platformCode: link.platformCode, status: { in: ["CONNECTED", "SYNCING"] } },
    });
    if (!connection) {
      await writeLog({
        platformCode:  link.platformCode,
        operationType: "SYNC_PRICE",
        direction:     "OUTBOUND",
        entityType:    "PRICE",
        entityId:      link.externalId,
        status:        "ERROR",
        errorMessage:  "اتصال این پلتفرم برقرار نیست",
      }).catch(() => {});
      tally.failed++;
      continue;
    }
    if (!connection.syncPriceEnabled) {
      await writeLog({
        platformCode:  link.platformCode,
        operationType: "SYNC_PRICE",
        direction:     "OUTBOUND",
        entityType:    "PRICE",
        entityId:      link.externalId,
        status:        "ERROR",
        errorMessage:  "همگام‌سازی قیمت برای این اتصال غیرفعال است — از صفحه اتصالات فعال کنید",
      }).catch(() => {});
      tally.failed++;
      continue;
    }

    const adapter = getAdapter(link.platformCode);
    if (!adapter?.updatePrice) { tally.skipped++; continue; }
    const credentials = decryptCredentials(connection.credentials);
    const start = Date.now();
    
    try {
      const { original, effective } = applyDiscount(price, discount);
      const result = await adapter.updatePrice(credentials, [
        {
          platformProductId: link.externalId,
          price:     original,
          salePrice: effective,
          discount,
        },
      ]);
    
      if (result.failed.length > 0) {
        await writeLog({
          platformCode: link.platformCode,
          operationType: "SYNC_PRICE",
          direction: "OUTBOUND",
          entityType: "PRICE",
          entityId: link.externalId,
          status: "ERROR",
          errorMessage:
            result.failed[0]?.error ?? "خطای نامشخص از پلتفرم",
          durationMs: Date.now() - start,
        }).catch(() => {});
        await recordDiscountPush(link.platformCode, link.externalId,
          result.failed[0]?.error ?? "خطای نامشخص از پلتفرم").catch(() => {});
        tally.failed++;
      } else {
        // snapshot باید همین‌جا تازه شود؛ وگرنه سینک موجودیِ بعدی (که در
        // اسنپ‌شاپ قیمت را هم می‌فرستد) قیمت قدیمی را برمی‌گرداند.
        await recordPushedPrice(link.platformCode, link.externalId, original, discount)
          .catch(() => {});
        await recordDiscountPush(link.platformCode, link.externalId).catch(() => {});

        await writeLog({
          platformCode: link.platformCode,
          operationType: "SYNC_PRICE",
          direction: "OUTBOUND",
          entityType: "PRICE",
          entityId: link.externalId,
          status: "SUCCESS",
          responseData: discount
            ? { price: original, salePrice: effective, discountPercent: discount.percent }
            : { price: original },
          durationMs: Date.now() - start,
        }).catch(() => {});
        tally.pushed++;
      }
    } catch (err) {
      await writeLog({
        platformCode: link.platformCode,
        operationType: "SYNC_PRICE",
        direction: "OUTBOUND",
        entityType: "PRICE",
        entityId: link.externalId,
        status: "ERROR",
        errorMessage: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      }).catch(() => {});
      await recordDiscountPush(link.platformCode, link.externalId,
        err instanceof Error ? err.message : String(err)).catch(() => {});
      tally.failed++;
    }

  }

  return tally;
}

// ── اعمال فوری قیمت یک نگاشت (بعد از ویرایش دستی قیمت خرید) ─────────
// بدون این، ویرایش دستی قیمت خرید فقط در دیتابیس می‌نشیند و تا وقتی کسی
// دکمه‌ی «همگام‌سازی قیمت» را نزند به هیچ پلتفرمی نمی‌رسد.
export async function pushPriceForMapping(mappingId: string): Promise<PricePushResult> {
  const mapping = await prisma.integMapping.findUnique({
    where:  { id: mappingId },
    select: { id: true, purchasePrice: true, stock: true, isActive: true, syncPriceEnabled: true },
  });
  if (!mapping?.isActive || !mapping.syncPriceEnabled) return emptyResult();

  const result = await pushMappingPrice(mapping);
  await prisma.integMapping.update({
    where: { id: mappingId },
    data:  { lastPriceSyncAt: new Date() },
  }).catch(() => {});
  return result;
}

// ── دکمه‌ی «بروزرسانی قیمت» — خواندن قیمت خرید از حسابداری + push به همه ──

export async function resyncPricesFromAccounting(
  jobId: string,
  accountingPlatformCode: string,
): Promise<{ updatedFromHesaban: number; pushedMappings: number }> {
  const connection = await prisma.integConnection.findFirst({
    where: { platformCode: accountingPlatformCode, status: { in: ["CONNECTED", "SYNCING"] } },
  });
  if (!connection) throw new Error(`اتصال ${accountingPlatformCode} برقرار نیست`);

  const adapter = getAdapter(accountingPlatformCode);
  if (!adapter) throw new Error(`آداپتور ${accountingPlatformCode} یافت نشد`);

  const credentials = decryptCredentials(connection.credentials);

  // ۱. خواندن قیمت خرید از حسابداری برای mapping‌های با منبع HESABAN
  let page = 1;
  let hasMore = true;
  let updatedFromHesaban = 0;

  while (hasMore) {
    const result = await adapter.fetchProducts(credentials, page, 100);

    for (const item of result.items) {
      if (item.purchasePrice == null) continue;

      const link = await prisma.integMappingLink.findUnique({
        where:   { platformCode_externalId: { platformCode: accountingPlatformCode, externalId: item.platformId } },
        include: { mapping: true },
      });

      if (!link?.isActive || !link.mapping.isActive) continue;
      if (link.mapping.purchasePriceSource !== "HESABAN") continue;

      await prisma.integMapping.update({
        where: { id: link.mappingId },
        data:  { purchasePrice: item.purchasePrice / 10, lastPriceSyncAt: new Date() },
      });
      updatedFromHesaban++;
    }

    hasMore = result.hasMore;
    page++;
  }

  // ۲. Push قیمت محاسبه‌شده به همه‌ی mapping‌های فعال (چه HESABAN چه MANUAL)
  const mappings = await prisma.integMapping.findMany({
    where: { isActive: true, syncPriceEnabled: true, purchasePrice: { not: null } },
    select: { id: true, purchasePrice: true, stock: true },
  });

  const totals: PricePushResult = { pushed: 0, failed: 0, skipped: 0 };
  for (const m of mappings) {
    const r = await pushMappingPrice(m);
    totals.pushed  += r.pushed;
    totals.failed  += r.failed;
    totals.skipped += r.skipped;
  }

  // «۵ نگاشت پردازش شد» وقتی هر ۱۴ ارسال رد شده باشد گزارشِ موفقیت نیست.
  // وضعیت لاگ را از نتیجه‌ی واقعی ارسال‌ها می‌گیریم، نه از تعداد نگاشت‌ها.
  const status = totals.failed === 0 ? "SUCCESS" : totals.pushed === 0 ? "ERROR" : "PARTIAL";

  await writeLog({
    jobId,
    platformCode:  accountingPlatformCode,
    operationType: "SYNC_ALL_PRICE",
    direction:     "INBOUND",
    entityType:    "PRICE",
    status,
    responseData:  { updatedFromHesaban, mappings: mappings.length, ...totals },
    errorMessage:  totals.failed > 0
      ? `${totals.failed} ارسال قیمت ناموفق بود — جزئیات هر کدام در لاگ‌های SYNC_PRICE همین بازه`
      : undefined,
  }).catch(() => {});

  return { updatedFromHesaban, pushedMappings: mappings.length };
}
// ── اجرای بازه‌ی تخفیف ────────────────────────────────────────────
// تپسی‌شاپ تاریخ شروع/پایان را نمی‌شناسد و فقط «قیمت نهایی» می‌گیرد، پس باز و
// بسته شدن بازه را باید خودمان با یک ارسال قیمت به او بفهمانیم. برای اسنپ‌شاپ
// هم بی‌ضرر است: همان تخفیف با همان تاریخ‌ها دوباره ارسال می‌شود.
export async function applyDiscountWindowChanges(): Promise<PricePushResult> {
  const changes = await findDiscountWindowChanges();
  const totals = emptyResult();
  if (!changes.length) return totals;

  // یک نگاشت ممکن است روی چند پلتفرم همزمان تغییر وضعیت بدهد؛ pushMappingPrice
  // همه‌ی لینک‌هایش را با هم می‌فرستد، پس هر نگاشت فقط یک بار پردازش می‌شود.
  for (const mappingId of new Set(changes.map((c) => c.mappingId))) {
    const r = await pushPriceForMapping(mappingId).catch(() => emptyResult());
    totals.pushed  += r.pushed;
    totals.failed  += r.failed;
    totals.skipped += r.skipped;
  }

  await writeLog({
    platformCode:  changes[0].platformCode,
    operationType: "SYNC_ALL_PRICE",
    direction:     "OUTBOUND",
    entityType:    "PRICE",
    status:        totals.failed === 0 ? "SUCCESS" : totals.pushed === 0 ? "ERROR" : "PARTIAL",
    responseData:  {
      reason:  "تغییر وضعیت بازه‌ی تخفیف",
      opened:  changes.filter((c) => c.activeNow).length,
      closed:  changes.filter((c) => !c.activeNow).length,
      ...totals,
    },
  }).catch(() => {});

  return totals;
}
