import { prisma } from "@/lib/prisma";
import type { IntegJob } from "@prisma/client";
import type { BaseAdapter } from "@/lib/integration/adapters/base.adapter";
import type { IntegProductInfo } from "@/lib/integration/types";
import { writeLog } from "./log";
import { getAdapter } from "./adapter-registry";
import { decryptCredentials } from "./crypto";
import { runAutoMatch } from "./mapping";

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
      await syncAllPrice(job.id, job.platformCode, adapter, credentials);
      break;
    }

    case "FETCH_PRODUCTS": {
      await fetchAndMatch(job.id, job.platformCode, adapter, credentials);
      break;
    }

    case "CREATE_PRODUCT":
      throw new Error(`Job type ${job.type} not yet implemented`);

    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}

// ── SYNC_ALL_STOCK ────────────────────────────────────────────────────
// برای پلتفرم‌های حسابداری (مثل Hesaban): موجودی را از پلتفرم می‌خواند و در فروشگاه به‌روزرسانی می‌کند
// برای مارکت‌پلیس‌ها (مثل Basalam): موجودی فروشگاه را به پلتفرم می‌فرستد

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
    // حسابداری → فروشگاه: خواندن موجودی از حسابداری و آپدیت در فروشگاه
    let page = 1;
    let updatedCount = 0;
    let hasMore = true;

    while (hasMore) {
      const result = await adapter.fetchProducts(credentials, page, 100);

      for (const item of result.items) {
        if (item.stock === undefined) continue;

        const mapping = await prisma.integProductMapping.findUnique({
          where: {
            platformCode_platformProductId: {
              platformCode,
              platformProductId: item.platformId,
            },
          },
        });

        if (mapping?.isActive) {
          await prisma.product.update({
            where: { id: mapping.shopProductId },
            data:  { stock: Math.max(0, Math.floor(item.stock)) },
          });
          updatedCount++;
        }
      }

      hasMore = result.hasMore;
      page++;
    }

    await writeLog({
      jobId,
      platformCode,
      operationType: "SYNC_ALL_STOCK",
      direction:     "INBOUND",
      entityType:    "STOCK",
      status:        "SUCCESS",
      responseData:  { updatedCount, pages: page - 1 },
    }).catch(() => {});
  } else {
    // مارکت‌پلیس ← فروشگاه: ارسال موجودی فعلی به پلتفرم
    const mappings = await prisma.integProductMapping.findMany({
      where:   { platformCode, isActive: true },
      include: { shopProduct: { select: { stock: true } } },
    });

    if (!mappings.length) return;

    const result = await adapter.updateStock(
      credentials,
      mappings.map((m) => ({
        platformProductId: m.platformProductId,
        stock:             m.shopProduct.stock,
      })),
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

// ── SYNC_ALL_PRICE ────────────────────────────────────────────────────

async function syncAllPrice(
  jobId: string,
  platformCode: string,
  adapter: BaseAdapter,
  credentials: Record<string, string>,
): Promise<void> {
  const platform = await prisma.integPlatform.findUnique({
    where: { code: platformCode },
  });

  if (platform?.type === "ACCOUNTING") {
    // حسابداری → فروشگاه: خواندن قیمت از حسابداری و آپدیت در فروشگاه
    let page = 1;
    let updatedCount = 0;
    let hasMore = true;

    while (hasMore) {
      const result = await adapter.fetchProducts(credentials, page, 100);

      for (const item of result.items) {
        if (!item.salePrice) continue;

        const mapping = await prisma.integProductMapping.findUnique({
          where: {
            platformCode_platformProductId: {
              platformCode,
              platformProductId: item.platformId,
            },
          },
        });

        if (mapping?.isActive) {
          await prisma.product.update({
            where: { id: mapping.shopProductId },
            data:  { price: BigInt(item.salePrice) },
          });
          updatedCount++;
        }
      }

      hasMore = result.hasMore;
      page++;
    }

    await writeLog({
      jobId,
      platformCode,
      operationType: "SYNC_ALL_PRICE",
      direction:     "INBOUND",
      entityType:    "PRICE",
      status:        "SUCCESS",
      responseData:  { updatedCount, pages: page - 1 },
    }).catch(() => {});
  } else {
    // مارکت‌پلیس ← فروشگاه: ارسال قیمت فعلی به پلتفرم
    if (!adapter.updatePrice) {
      throw new Error(`${platformCode} does not support price sync`);
    }

    const mappings = await prisma.integProductMapping.findMany({
      where:   { platformCode, isActive: true },
      include: { shopProduct: { select: { price: true, salePrice: true } } },
    });

    if (!mappings.length) return;

    const result = await adapter.updatePrice(
      credentials,
      mappings.map((m) => ({
        platformProductId: m.platformProductId,
        price:             Number(m.shopProduct.price),
        salePrice:         m.shopProduct.salePrice ? Number(m.shopProduct.salePrice) : undefined,
      })),
    );

    await writeLog({
      jobId,
      platformCode,
      operationType: "SYNC_ALL_PRICE",
      direction:     "OUTBOUND",
      entityType:    "PRICE",
      status:        result.failed.length === 0 ? "SUCCESS" : result.success.length > 0 ? "PARTIAL" : "ERROR",
      responseData:  { success: result.success.length, failed: result.failed.length },
    }).catch(() => {});
  }
}

// ── FETCH_PRODUCTS + AUTO-MATCH ──────────────────────────────────────
// دریافت کل محصولات پلتفرم و اجرای auto-match با محصولات فروشگاه

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

  while (hasMore) {
    const result = await adapter.fetchProducts(credentials, page, 100);
    totalFetched += result.items.length;

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
