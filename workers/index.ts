/**
 * پروسه Worker — جدا از Next.js اجرا می‌شود
 *
 * اجرا در توسعه:  pnpm worker
 * اجرا در تولید:  pm2 start ecosystem.config.js --only mymonta-worker
 */

import "../lib/load-env";
import { Worker, Job } from "bullmq";
import { redis, pingRedis } from "../lib/redis";
import {
  QUEUE_NAMES,
  QUEUE_PREFIX,
  enqueueStatusCheck,
  type SmsBatchJob,
} from "../lib/club/queue";
import { dispatchBatch } from "../lib/club/sms";
import { prisma } from "../lib/prisma";

const CONCURRENCY = Number(process.env.CLUB_WORKER_CONCURRENCY ?? 5);

async function main() {
  if (!(await pingRedis())) {
    console.error("[worker] اتصال به Redis برقرار نشد. REDIS_URL را بررسی کنید.");
    process.exit(1);
  }
  console.log("[worker] اتصال Redis برقرار است");

  // ── صف ارسال پیامک ────────────────────────────────────────────────
  const smsWorker = new Worker<SmsBatchJob>(
    QUEUE_NAMES.SMS_SEND,
    async (job: Job<SmsBatchJob>) => {
      const { recipients, kind, text, templateKey, campaignId, automationId } = job.data;

      console.log(`[worker:sms] ${job.id} — ${recipients.length} گیرنده — ${kind}`);

      const result = await dispatchBatch({
        kind,
        text,
        templateKey,
        campaignId,
        automationId,
        recipients: recipients.map((r) => ({
          phone: r.mobile,
          userId: r.userId ?? null,
          vars: r.vars,
        })),
      });

      // پیگیری وضعیت تحویل، ۳ دقیقه بعد
      if (result.requestId) {
        await enqueueStatusCheck({ providerRequestIds: [result.requestId] }, 180_000);
      }

      if (campaignId) {
        await prisma.smsCampaign
          .update({
            where: { id: campaignId },
            data: {
              sentCount: { increment: result.sentCount },
              skippedCount: { increment: result.skippedCount },
            },
          })
          .catch(() => {});
      }

      return result;
    },
    {
      connection: redis,
      prefix: QUEUE_PREFIX,
      concurrency: CONCURRENCY,
      limiter: { max: 10, duration: 1000 },
    }
  );

  smsWorker.on("completed", (job, result) => {
    console.log(
      `[worker:sms] ✅ ${job.id} — ارسال ${result?.sentCount ?? 0} · رد ${result?.skippedCount ?? 0}`
    );
  });

  smsWorker.on("failed", async (job, err) => {
    console.error(`[worker:sms] ❌ ${job?.id} — ${err.message}`);

    const isFinal = job && job.attemptsMade >= (job.opts.attempts ?? 1);
    if (isFinal && job?.data.campaignId) {
      await prisma.smsCampaign
        .update({
          where: { id: job.data.campaignId },
          data: { failedCount: { increment: job.data.recipients.length } },
        })
        .catch(() => {});
    }
  });

  console.log(`[worker] آماده — همزمانی ${CONCURRENCY}`);

  // ── خاموشی تمیز ───────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    console.log(`[worker] دریافت ${signal} — در حال خاموش شدن...`);
    await smsWorker.close();
    await prisma.$disconnect();
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