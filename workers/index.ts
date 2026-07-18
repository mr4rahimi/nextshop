/**
 * پروسه Worker — جدا از Next.js اجرا می‌شود
 *
 * اجرا در توسعه:  pnpm worker
 * اجرا در تولید:  pm2 start ecosystem.config.js --only mymonta-worker
 *
 * در فاز ۰ فقط اسکلت و اتصال‌ها ساخته می‌شود. منطق واقعی ارسال پیامک
 * در فاز ۲ به `smsWorker.ts` اضافه می‌گردد.
 */

import "dotenv/config";
import { Worker, Job } from "bullmq";
import { redis, pingRedis } from "../lib/redis";
import { QUEUE_NAMES, QUEUE_PREFIX, SmsBatchJob } from "../lib/club/queue";

const CONCURRENCY = Number(process.env.CLUB_WORKER_CONCURRENCY ?? 5);

async function main() {
  const ok = await pingRedis();
  if (!ok) {
    console.error("[worker] اتصال به Redis برقرار نشد. REDIS_URL را بررسی کنید.");
    process.exit(1);
  }
  console.log("[worker] اتصال Redis برقرار است");

  // ── صف ارسال پیامک ────────────────────────────────────────────────
  const smsWorker = new Worker<SmsBatchJob>(
    QUEUE_NAMES.SMS_SEND,
    async (job: Job<SmsBatchJob>) => {
      // TODO فاز ۲: فراخوانی درایور ایران پیامک
      console.log(
        `[worker:sms] job=${job.id} گیرنده=${job.data.recipients.length} نوع=${job.data.kind}`
      );
      return { ok: true, count: job.data.recipients.length };
    },
     {
      connection: redis,
      prefix: QUEUE_PREFIX,
      concurrency: CONCURRENCY,
      limiter: { max: 10, duration: 1000 },
    }
  );

  smsWorker.on("completed", (job) => {
    console.log(`[worker:sms] ✅ ${job.id}`);
  });

  smsWorker.on("failed", (job, err) => {
    console.error(`[worker:sms] ❌ ${job?.id} — ${err.message}`);
  });

  console.log(`[worker] آماده — همزمانی ${CONCURRENCY}`);

  // ── خاموشی تمیز ───────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    console.log(`[worker] دریافت ${signal} — در حال خاموش شدن...`);
    await smsWorker.close();
    await redis.quit();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[worker] خطای بحرانی:", err);
  process.exit(1);
});
