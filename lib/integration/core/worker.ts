import { prisma } from "@/lib/prisma";
import type { IntegJob } from "@prisma/client";
import type { BaseAdapter } from "@/lib/integration/adapters/base.adapter";
import type { IntegProductInfo } from "@/lib/integration/types";
import { writeLog } from "./log";
import { getAdapter } from "./adapter-registry";
import { decryptCredentials } from "./crypto";
import { runAutoMatch } from "./mapping";
import { resyncPricesFromAccounting } from "./pricing";

import { resyncStockFromAccounting } from "./inventory";
import { fetchAndProcessOrders } from "./orders";
import { enqueue } from "./queue";

// اجرای یک چرخه Worker — فراخوانی هر N ثانیه
export async function runWorkerCycle(maxJobs = 5): Promise<void> {
  const settings = await prisma.integSettings.findUnique({ where: { id: "singleton" } });
  if (!settings?.workerEnabled) return;

  const concurrent = Math.min(maxJobs, settings.maxConcurrentJobs);

  // گرفتن job‌های pending به صورت atomic با FOR UPDATE SKIP LOCKED
  const jobs: IntegJob[] = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<IntegJob[]>`
      SELECT * FROM "IntegJob"
      WHERE status = 'PENDING' AND "scheduledAt" <= NOW()
      ORDER BY priority ASC, "scheduledAt" ASC
      LIMIT ${concurrent}
      FOR UPDATE SKIP LOCKED
    `;
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    await tx.integJob.updateMany({
      where: { id: { in: ids } },
      data:  { status: "PROCESSING", startedAt: new Date(), attempts: { increment: 1 } },
    });
    return rows;
  });

  if (!jobs.length) return;

  await Promise.allSettled(jobs.map((job) => executeJob(job)));
}

async function executeJob(job: IntegJob): Promise<void> {
  const start = Date.now();
  try {
    await dispatchJob(job);
    await prisma.integJob.update({
      where: { id: job.id },
      data:  { status: "DONE", completedAt: new Date() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const newAttempts = job.attempts + 1; // attempts قبلاً increment شده

    if (newAttempts >= job.maxAttempts) {
      await prisma.integJob.update({
        where: { id: job.id },
        data:  { status: "FAILED", lastError: message, completedAt: new Date() },
      });
    } else {
      // exponential backoff: 1m، 4m، 9m ...
      const delayMs = Math.pow(newAttempts, 2) * 60_000;
      await prisma.integJob.update({
        where: { id: job.id },
        data: {
          status:      "PENDING",
          lastError:   message,
          scheduledAt: new Date(Date.now() + delayMs),
        },
      });
    }

    await writeLog({
      jobId:        job.id,
      platformCode: job.platformCode,
      operationType: job.type,
      direction:    "OUTBOUND",
      entityType:   "PRODUCT",
      status:       "ERROR",
      errorMessage: message,
      durationMs:   Date.now() - start,
    }).catch(() => {});
  }
}

async function dispatchJob(job: IntegJob): Promise<void> {
  const adapter = getAdapter(job.platformCode);
  if (!adapter) throw new Error(`No adapter for platform: ${job.platformCode}`);

  const connection = await prisma.integConnection.findFirst({
    where: { platformCode: job.platformCode, status: { in: ["CONNECTED", "SYNCING"] } },
  });
  if (!connection) throw new Error(`No active connection for platform: ${job.platformCode}`);

  const credentials = decryptCredentials(connection.credentials);
  const payload = job.payload as Record<string, any>;

  switch (job.type) {
    case "TEST_CONNECTION": {
      await adapter.testConnection(credentials);
      break;
    }

    case "SYNC_STOCK": {
      await adapter.updateStock(credentials, [{
        platformProductId: payload.platformProductId,
        stock:             payload.stock,
      }]);
      break;
    }

    case "SYNC_PRICE": {
      if (!adapter.updatePrice) throw new Error(`${job.platformCode} does not support price sync`);
      await adapter.updatePrice(credentials, [{
        platformProductId: payload.platformProductId,
        price:             payload.price,
        salePrice:         payload.salePrice,
      }]);
      break;
    }

    case "SYNC_ALL_STOCK": {
      await syncAllStock(job.id, job.platformCode, adapter, credentials);
      break;
    }

    case "SYNC_ALL_PRICE": {
      await resyncPricesFromAccounting(job.id, job.platformCode);
      break;
    }

    case "FETCH_PRODUCTS": {
      await fetchAndMatch(job.id, job.platformCode, adapter, credentials);
      break;
    }

     case "FETCH_ORDERS": {
      await fetchAndProcessOrders(job.id, job.platformCode, adapter, credentials);
      await enqueue({
        type:         "FETCH_ORDERS",
        platformCode: job.platformCode,
        payload:      {},
        priority:     3,
        delayMs:      connection.syncIntervalMin * 60_000,
      });
      break;
    }

    case "CREATE_PRODUCT":
      throw new Error(`Job type ${job.type} not yet implemented`);

    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}


async function syncAllStock(
  jobId: string,
  platformCode: string,
  adapter: BaseAdapter,
  credentials: Record<string, string>,
): Promise<void> {
  const platform = await prisma.integPlatform.findUnique({
    where: { code: platformCode },
  });

  if (platform?.type === "ACCOUNTING") {
    await resyncStockFromAccounting(jobId, platformCode);
  } else {
   
    const platformLinks = await prisma.integMappingLink.findMany({
      where:   { platformCode, isActive: true },
      include: { mapping: { include: { links: { where: { platformCode: "shop", isActive: true } } } } },
    });

    const pairs = platformLinks
      .map((l) => ({ platformProductId: l.externalId, shopProductId: l.mapping.links[0]?.externalId }))
      .filter((p): p is { platformProductId: string; shopProductId: string } => Boolean(p.shopProductId));

    if (!pairs.length) {
      await writeLog({
        jobId,
        platformCode,
        operationType: "SYNC_ALL_STOCK",
        direction:     "OUTBOUND",
        entityType:    "STOCK",
        status:        "ERROR",
        errorMessage:  "هیچ محصول نگاشت‌شده‌ای با لینک فعال فروشگاه یافت نشد — این مسیر منسوخ شده؛ از صفحه «مدیریت موجودی» استفاده کنید",
      }).catch(() => {});
      return;
    }

    const shopProducts = await prisma.product.findMany({
      where:  { id: { in: pairs.map((p) => p.shopProductId) } },
      select: { id: true, stock: true },
    });
    const stockMap = new Map(shopProducts.map((p) => [p.id, p.stock]));

    const result = await adapter.updateStock(
      credentials,
      pairs.map((p) => ({ platformProductId: p.platformProductId, stock: stockMap.get(p.shopProductId) ?? 0 })),
    );

    await writeLog({
      jobId,
      platformCode,
      operationType: "SYNC_ALL_STOCK",
      direction:     "OUTBOUND",
      entityType:    "STOCK",
      status:        result.failed.length === 0 ? "SUCCESS" : result.success.length > 0 ? "PARTIAL" : "ERROR",
      responseData:  { success: result.success.length, failed: result.failed.length },
    }).catch(() => {});
  }
}


async function fetchAndMatch(
  jobId: string,
  platformCode: string,
  adapter: BaseAdapter,
  credentials: Record<string, string>,
): Promise<void> {
  let page = 1;
  let totalFetched = 0;
  let autoMapped   = 0;
  let suggested    = 0;
  let hasMore      = true;

  const now = new Date();

  while (hasMore) {
    const result = await adapter.fetchProducts(credentials, page, 100);
    totalFetched += result.items.length;

    // ذخیره محصولات خام در IntegPlatformProduct
    for (const item of result.items) {
      await prisma.integPlatformProduct.upsert({
        where: {
          platformCode_platformProductId: {
            platformCode,
            platformProductId: item.platformId,
          },
        },
        update: {
          title:         item.title,
          sku:           item.sku ?? null,
          barcode:       item.barcode ?? null,
          stock:         item.stock ?? null,
          price:         item.salePrice ?? null,
          purchasePrice: item.purchasePrice ?? null,
          unit:          item.unit ?? null,
          isEnabled:     true,
          lastFetchedAt: now,
          updatedAt:     now,
        },
        create: {
          platformCode,
          platformProductId: item.platformId,
          title:         item.title,
          sku:           item.sku ?? null,
          barcode:       item.barcode ?? null,
          stock:         item.stock ?? null,
          price:         item.salePrice ?? null,
          purchasePrice: item.purchasePrice ?? null,
          unit:          item.unit ?? null,
          lastFetchedAt: now,
        },
      });
    }

    const matchResult = await runAutoMatch(platformCode, result.items);
    autoMapped += matchResult.autoMapped;
    suggested  += matchResult.suggested;

    hasMore = result.hasMore;
    page++;
  }

  // آپدیت lastSyncAt روی اتصال
  await prisma.integConnection.updateMany({
    where: { platformCode },
    data:  { lastSyncAt: new Date() },
  });

  await writeLog({
    jobId,
    platformCode,
    operationType: "FETCH_PRODUCTS",
    direction:     "INBOUND",
    entityType:    "PRODUCT",
    status:        "SUCCESS",
    responseData:  { totalFetched, autoMapped, suggested, pages: page - 1 },
  }).catch(() => {});
}