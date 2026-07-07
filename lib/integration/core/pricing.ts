import { prisma } from "@/lib/prisma";
import type { IntegPriceRule, IntegPriceRuleTier } from "@prisma/client";
import { getAdapter } from "./adapter-registry";
import { decryptCredentials } from "./crypto";
import { writeLog } from "./log";

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

async function pushMappingPrice(mapping: {
  id: string;
  purchasePrice: number | null;
  stock: number;
}): Promise<void> {
  if (mapping.purchasePrice == null) return;

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
    if (platform?.type === "ACCOUNTING") continue; // به حسابداری قیمت پوش نمی‌کنیم

    const rule = await findApplicableRule(link.platformCode, shopProduct);
    if (!rule) continue;

    const price = calculatePrice(rule, mapping.purchasePrice, mapping.stock);

    if (link.platformCode === "shop") {
      await prisma.product.update({
        where: { id: link.externalId },
        data:  { price: BigInt(Math.round(price)) },
      }).catch(() => {});
      continue;
    }

    const connection = await prisma.integConnection.findFirst({
      where: { platformCode: link.platformCode, status: { in: ["CONNECTED", "SYNCING"] }, syncPriceEnabled: true },
    });
    if (!connection) continue;

    const adapter = getAdapter(link.platformCode);
    if (!adapter?.updatePrice) continue;

    const credentials = decryptCredentials(connection.credentials);
    const start = Date.now();

    try {
      await adapter.updatePrice(credentials, [{ platformProductId: link.externalId, price }]);
      await writeLog({
        platformCode:  link.platformCode,
        operationType: "SYNC_PRICE",
        direction:     "OUTBOUND",
        entityType:    "PRICE",
        entityId:      link.externalId,
        status:        "SUCCESS",
        durationMs:    Date.now() - start,
      }).catch(() => {});
    } catch (err) {
      await writeLog({
        platformCode:  link.platformCode,
        operationType: "SYNC_PRICE",
        direction:     "OUTBOUND",
        entityType:    "PRICE",
        entityId:      link.externalId,
        status:        "ERROR",
        errorMessage:  err instanceof Error ? err.message : String(err),
        durationMs:    Date.now() - start,
      }).catch(() => {});
    }
  }
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

  for (const m of mappings) {
    await pushMappingPrice(m);
  }

  await writeLog({
    jobId,
    platformCode:  accountingPlatformCode,
    operationType: "SYNC_ALL_PRICE",
    direction:     "INBOUND",
    entityType:    "PRICE",
    status:        "SUCCESS",
    responseData:  { updatedFromHesaban, pushedMappings: mappings.length },
  }).catch(() => {});

  return { updatedFromHesaban, pushedMappings: mappings.length };
}

async function pushMappingPrice(mapping: {
  id: string;
  purchasePrice: number | null;
  stock: number;
}): Promise<void> {
  if (mapping.purchasePrice == null) return;

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
    if (platform?.type === "ACCOUNTING") continue;

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
      continue;
    }

    const price = calculatePrice(rule, mapping.purchasePrice, mapping.stock);

    if (link.platformCode === "shop") {
      await prisma.product.update({
        where: { id: link.externalId },
        data:  { price: BigInt(Math.round(price)) },
      }).catch(() => {});
      continue;
    }

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
      continue;
    }

    const adapter = getAdapter(link.platformCode);
    if (!adapter?.updatePrice) continue;

    const credentials = decryptCredentials(connection.credentials);
    const start = Date.now();

    try {
      await adapter.updatePrice(credentials, [{ platformProductId: link.externalId, price }]);
      await writeLog({
        platformCode:  link.platformCode,
        operationType: "SYNC_PRICE",
        direction:     "OUTBOUND",
        entityType:    "PRICE",
        entityId:      link.externalId,
        status:        "SUCCESS",
        durationMs:    Date.now() - start,
      }).catch(() => {});
    } catch (err) {
      await writeLog({
        platformCode:  link.platformCode,
        operationType: "SYNC_PRICE",
        direction:     "OUTBOUND",
        entityType:    "PRICE",
        entityId:      link.externalId,
        status:        "ERROR",
        errorMessage:  err instanceof Error ? err.message : String(err),
        durationMs:    Date.now() - start,
      }).catch(() => {});
    }
  }
}