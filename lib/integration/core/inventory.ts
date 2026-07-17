import { prisma } from "@/lib/prisma";
import { getAdapter } from "./adapter-registry";
import { decryptCredentials } from "./crypto";
import { writeLog } from "./log";

async function getPlatformType(platformCode: string): Promise<"ACCOUNTING" | "MARKETPLACE" | null> {
  const p = await prisma.integPlatform.findUnique({ where: { code: platformCode }, select: { type: true } });
  return p?.type ?? null;
}


async function pushMappingStock(
  mappingId: string,
  stock: number,
  excludePlatformCode?: string,
): Promise<void> {
  const links = await prisma.integMappingLink.findMany({
    where: { mappingId, isActive: true },
  });

  for (const link of links) {
    if (link.platformCode === excludePlatformCode) continue;

    if (link.platformCode === "shop") {
      await prisma.product.update({
        where: { id: link.externalId },
        data:  { stock: Math.max(0, Math.floor(stock)) },
      }).catch(() => {});
      continue;
    }

    const platformType = await getPlatformType(link.platformCode);
    if (platformType === "ACCOUNTING") continue;

    const adapter = getAdapter(link.platformCode);
    if (!adapter) {
      await writeLog({
        platformCode:  link.platformCode,
        operationType: "SYNC_STOCK",
        direction:     "OUTBOUND",
        entityType:    "STOCK",
        entityId:      link.externalId,
        status:        "ERROR",
        errorMessage:  "آداپتور این پلتفرم یافت نشد",
      }).catch(() => {});
      continue;
    }

    const connection = await prisma.integConnection.findFirst({
      where: { platformCode: link.platformCode, status: { in: ["CONNECTED", "SYNCING"] } },
    });
    if (!connection) {
      await writeLog({
        platformCode:  link.platformCode,
        operationType: "SYNC_STOCK",
        direction:     "OUTBOUND",
        entityType:    "STOCK",
        entityId:      link.externalId,
        status:        "ERROR",
        errorMessage:  "اتصال این پلتفرم برقرار نیست یا وضعیت CONNECTED/SYNCING ندارد",
      }).catch(() => {});
      continue;
    }
    if (!connection.syncStockEnabled) {
      await writeLog({
        platformCode:  link.platformCode,
        operationType: "SYNC_STOCK",
        direction:     "OUTBOUND",
        entityType:    "STOCK",
        entityId:      link.externalId,
        status:        "ERROR",
        errorMessage:  "همگام‌سازی موجودی برای این اتصال غیرفعال است — از صفحه اتصالات فعال کنید",
      }).catch(() => {});
      continue;
    }

    const credentials = decryptCredentials(connection.credentials);
    const start = Date.now();

    try {
      const result = await adapter.updateStock(credentials, [
        { platformProductId: link.externalId, stock: Math.max(0, Math.floor(stock)) },
      ]);

      if (result.failed.length > 0) {
        await writeLog({
          platformCode:  link.platformCode,
          operationType: "SYNC_STOCK",
          direction:     "OUTBOUND",
          entityType:    "STOCK",
          entityId:      link.externalId,
          status:        "ERROR",
          errorMessage:  result.failed[0]?.error ?? "خطای نامشخص از پلتفرم",
          durationMs:    Date.now() - start,
        }).catch(() => {});
      } else {
        await writeLog({
          platformCode:  link.platformCode,
          operationType: "SYNC_STOCK",
          direction:     "OUTBOUND",
          entityType:    "STOCK",
          entityId:      link.externalId,
          status:        "SUCCESS",
          responseData:  { stock },
          durationMs:    Date.now() - start,
        }).catch(() => {});
      }
    } catch (err) {
      await writeLog({
        platformCode:  link.platformCode,
        operationType: "SYNC_STOCK",
        direction:     "OUTBOUND",
        entityType:    "STOCK",
        entityId:      link.externalId,
        status:        "ERROR",
        errorMessage:  err instanceof Error ? err.message : String(err),
        durationMs:    Date.now() - start,
      }).catch(() => {});
    }
  }
}



export async function resyncStockFromAccounting(
  jobId: string,
  accountingPlatformCode: string,
): Promise<{ updatedCount: number; pages: number }> {
  const connection = await prisma.integConnection.findFirst({
    where: { platformCode: accountingPlatformCode, status: { in: ["CONNECTED", "SYNCING"] } },
  });
  if (!connection) throw new Error(`اتصال ${accountingPlatformCode} برقرار نیست`);

  const adapter = getAdapter(accountingPlatformCode);
  if (!adapter) throw new Error(`آداپتور ${accountingPlatformCode} یافت نشد`);

  const credentials = decryptCredentials(connection.credentials);

  let page = 1;
  let hasMore = true;
  let updatedCount = 0;

  while (hasMore) {
    const result = await adapter.fetchProducts(credentials, page, 100);

    for (const item of result.items) {
      if (item.stock === undefined) continue;

      const link = await prisma.integMappingLink.findUnique({
        where: { platformCode_externalId: { platformCode: accountingPlatformCode, externalId: item.platformId } },
        include: { mapping: true },
      });

      if (!link?.isActive || !link.mapping.isActive || !link.mapping.syncStockEnabled) continue;

      const newStock = Math.max(0, Math.floor(item.stock));

      await prisma.integMapping.update({
        where: { id: link.mappingId },
        data: {
          stock:            newStock,
          lastHesabanStock: newStock,
          lastStockSyncAt:  new Date(),
        },
      });

      await pushMappingStock(link.mappingId, newStock, accountingPlatformCode);
      updatedCount++;
    }

    hasMore = result.hasMore;
    page++;
  }

  await prisma.integConnection.updateMany({
    where: { platformCode: accountingPlatformCode },
    data:  { lastSyncAt: new Date() },
  });

  await writeLog({
    jobId,
    platformCode:  accountingPlatformCode,
    operationType: "SYNC_ALL_STOCK",
    direction:     "INBOUND",
    entityType:    "STOCK",
    status:        "SUCCESS",
    responseData:  { updatedCount, pages: page - 1 },
  }).catch(() => {});

  return { updatedCount, pages: page - 1 };
}



// برگرداندن موجودی نگاشت هنگام لغو سفارش (معکوس decrement) + push به پلتفرم‌ها
export async function restoreMappingStockForCancel(
  sourcePlatformCode: string,
  externalId: string,
  qty: number,
): Promise<void> {
  const link = await prisma.integMappingLink.findUnique({
    where: { platformCode_externalId: { platformCode: sourcePlatformCode, externalId } },
    include: { mapping: true },
  });

  if (!link?.isActive || !link.mapping.isActive || !link.mapping.syncStockEnabled) return;

  const newStock = link.mapping.stock + qty;

  await prisma.integMapping.update({
    where: { id: link.mappingId },
    data:  { stock: newStock },
  });

  await writeLog({
    platformCode:  sourcePlatformCode,
    operationType: "FETCH_ORDERS",
    direction:     "INBOUND",
    entityType:    "STOCK",
    entityId:      externalId,
    status:        "SUCCESS",
    responseData:  { action: "برگشت موجودی (لغو سفارش)", qty, from: link.mapping.stock, to: newStock },
  }).catch(() => {});

  await pushMappingStock(link.mappingId, newStock, sourcePlatformCode);
}

export async function decrementMappingStockForOrder(
  sourcePlatformCode: string,
  externalId: string,
  qty: number,
): Promise<void> {
  const link = await prisma.integMappingLink.findUnique({
    where: { platformCode_externalId: { platformCode: sourcePlatformCode, externalId } },
    include: { mapping: true },
  });

  if (!link?.isActive || !link.mapping.isActive || !link.mapping.syncStockEnabled) {
    // سفارش مارکت‌پلیس برای محصول بدون نگاشت/غیرفعال — باید در لاگ ادمین دیده شود
    if (sourcePlatformCode !== "shop") {
      await writeLog({
        platformCode:  sourcePlatformCode,
        operationType: "FETCH_ORDERS",
        direction:     "INBOUND",
        entityType:    "STOCK",
        entityId:      externalId,
        status:        "ERROR",
        errorMessage:  link
          ? "نگاشت یا همگام‌سازی موجودی این محصول غیرفعال است — کسر موجودی انجام نشد"
          : "سفارش برای محصولی بدون نگاشت — کسر موجودی انجام نشد (شناسه محصول پلتفرم را در نگاشت لینک کنید)",
      }).catch(() => {});
    }
    return;
  }

  const newStock = Math.max(0, link.mapping.stock - qty);

  await prisma.integMapping.update({
    where: { id: link.mappingId },
    data:  { stock: newStock },
  });

  await writeLog({
    platformCode:  sourcePlatformCode,
    operationType: "FETCH_ORDERS",
    direction:     "INBOUND",
    entityType:    "STOCK",
    entityId:      externalId,
    status:        "SUCCESS",
    responseData:  { action: "کسر موجودی سفارش", qty, from: link.mapping.stock, to: newStock },
  }).catch(() => {});

  await pushMappingStock(link.mappingId, newStock, sourcePlatformCode);
}