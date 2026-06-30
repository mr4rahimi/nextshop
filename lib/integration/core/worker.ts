import { prisma } from "@/lib/prisma";
import type { IntegJob } from "@prisma/client";
import { writeLog } from "./log";
import { getAdapter } from "./adapter-registry";
import { decryptCredentials } from "./crypto";

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

    case "SYNC_ALL_STOCK":
    case "SYNC_ALL_PRICE":
    case "FETCH_PRODUCTS":
    case "CREATE_PRODUCT":
      // این‌ها در فازهای بعدی پیاده‌سازی می‌شوند
      throw new Error(`Job type ${job.type} not yet implemented`);

    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}
