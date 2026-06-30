import { prisma } from "@/lib/prisma";
import type { IntegJobType } from "@prisma/client";

export interface EnqueueOptions {
  type:         IntegJobType;
  platformCode: string;
  payload:      unknown;
  priority?:    number;   // 1 = بالاترین اولویت، پیش‌فرض: 5
  delayMs?:     number;   // تأخیر قبل از اجرا
  maxAttempts?: number;
}

// اضافه کردن job به queue
export async function enqueue(opts: EnqueueOptions) {
  const scheduledAt = opts.delayMs
    ? new Date(Date.now() + opts.delayMs)
    : new Date();

  return prisma.integJob.create({
    data: {
      type:         opts.type,
      platformCode: opts.platformCode,
      payload:      opts.payload as any,
      priority:     opts.priority ?? 5,
      maxAttempts:  opts.maxAttempts ?? 3,
      scheduledAt,
    },
  });
}

// لغو یک job در حالت PENDING
export async function cancelJob(jobId: string) {
  return prisma.integJob.updateMany({
    where:  { id: jobId, status: "PENDING" },
    data:   { status: "CANCELLED" },
  });
}

// retry دستی یک job شکست‌خورده
export async function retryJob(jobId: string) {
  return prisma.integJob.updateMany({
    where: { id: jobId, status: "FAILED" },
    data: {
      status:    "PENDING",
      attempts:  0,
      lastError: null,
      scheduledAt: new Date(),
    },
  });
}

// آمار queue
export async function getQueueStats() {
  const [pending, processing, failed, done] = await Promise.all([
    prisma.integJob.count({ where: { status: "PENDING" } }),
    prisma.integJob.count({ where: { status: "PROCESSING" } }),
    prisma.integJob.count({ where: { status: "FAILED" } }),
    prisma.integJob.count({ where: { status: "DONE" } }),
  ]);
  return { pending, processing, failed, done };
}

// helper‌های خاص برای فروشگاه — این‌ها را shop می‌تواند import کند
export async function enqueueStockSync(
  shopProductId: string,
  platformCode:  string,
  platformProductId: string,
  newStock: number
) {
  return enqueue({
    type:         "SYNC_STOCK",
    platformCode,
    payload:      { shopProductId, platformProductId, stock: newStock },
    priority:     3,
  });
}

export async function enqueuePriceSync(
  shopProductId: string,
  platformCode:  string,
  platformProductId: string,
  price: number,
  salePrice?: number
) {
  return enqueue({
    type:         "SYNC_PRICE",
    platformCode,
    payload:      { shopProductId, platformProductId, price, salePrice },
    priority:     4,
  });
}
