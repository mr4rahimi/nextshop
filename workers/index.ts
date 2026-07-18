/**
 * پروسه Worker — جدا از Next.js اجرا می‌شود
 *
 * اجرا در توسعه:  pnpm worker
 * اجرا در تولید:  pm2 start ecosystem.config.js --only mymonta-worker
 *
 * سه مسئولیت:
 *   ۱. ارسال دسته‌های پیامک از صف
 *   ۲. پیگیری وضعیت تحویل
 *   ۳. کرون‌های دوره‌ای (صندوق ورودی، نهایی کردن کمپین‌ها)
 */

import "../lib/load-env";
import { Worker, Job } from "bullmq";
import { redis, pingRedis } from "../lib/redis";
import {
  QUEUE_NAMES,
  QUEUE_PREFIX,
  clubCronQueue,
  enqueueStatusCheck,
  type SmsBatchJob,
  type SmsStatusJob,
} from "../lib/club/queue";
import { dispatchBatch } from "../lib/club/sms";
import {
  syncSendRequest,
  syncPendingDeliveries,
  pollInbox,
  finalizeCampaigns,
} from "../lib/club/sms/sync";
import { prisma } from "../lib/prisma";

const CONCURRENCY = Number(process.env.CLUB_WORKER_CONCURRENCY ?? 5);

// ─── کرون‌ها ─────────────────────────────────────────────────────────

const CRON_JOBS = [
  { name: "sync-deliveries", every: 15 * 60_000 },
  { name: "poll-inbox", every: 10 * 60_000 },
  { name: "finalize-campaigns", every: 5 * 60_000 },
] as const;

async function registerCronJobs() {
  const queue = clubCronQueue();

  // کارهای تکرارشونده قدیمی را پاک کن تا با تغییر بازه‌ها تکراری نشوند
  const existing = await queue.getRepeatableJobs();
  for (const job of existing) {
    await queue.removeRepeatableByKey(job.key);
  }

  for (const job of CRON_JOBS) {
    await queue.add(
      job.name,
      {},
      {
        repeat: { every: job.every },
        jobId: job.name,
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 50 },
      }
    );
  }

  console.log(`[worker] ${CRON_JOBS.length} کرون ثبت شد`);
}

// ─── راه‌اندازی ──────────────────────────────────────────────────────

async function main() {
  if (!(await pingRedis())) {
    console.error("[worker] اتصال به Redis برقرار نشد. REDIS_URL را بررسی کنید.");
    process.exit(1);
  }
  console.log("[worker] اتصال Redis برقرار است");

  // ── ۱. ارسال پیامک ──────────────────────────────────────────────
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

  // ── ۲. پیگیری وضعیت تحویل ───────────────────────────────────────
  const statusWorker = new Worker<SmsStatusJob>(
    QUEUE_NAMES.SMS_STATUS,
    async (job: Job<SmsStatusJob>) => {
      const ids = job.data.providerRequestIds ?? [];
      let delivered = 0;
      let failed = 0;
      let optedOut = 0;
      let needsRecheck = false;

      for (const id of ids) {
        const r = await syncSendRequest(id);
        delivered += r.delivered;
        failed += r.failed;
        optedOut += r.optedOut;
        if (!r.finished) needsRecheck = true;
      }

      // اگر هنوز نهایی نشده، ۱۰ دقیقه دیگر دوباره بررسی کن
      // سقف ۶ بار تلاش با backoff صف
      if (needsRecheck && (job.attemptsMade ?? 0) < 1) {
        await enqueueStatusCheck({ providerRequestIds: ids }, 600_000);
      }

      return { delivered, failed, optedOut };
    },
    {
      connection: redis,
      prefix: QUEUE_PREFIX,
      concurrency: 2,
      limiter: { max: 5, duration: 1000 },
    }
  );

  statusWorker.on("completed", (job, r) => {
    if (r && (r.delivered || r.failed || r.optedOut)) {
      console.log(
        `[worker:status] ${job.id} — تحویل ${r.delivered} · ناموفق ${r.failed} · لغو ${r.optedOut}`
      );
    }
  });

  statusWorker.on("failed", (job, err) => {
    console.error(`[worker:status] ❌ ${job?.id} — ${err.message}`);
  });

  // ── ۳. کرون‌ها ──────────────────────────────────────────────────
  const cronWorker = new Worker(
    QUEUE_NAMES.CLUB_CRON,
    async (job: Job) => {
      switch (job.name) {
        case "sync-deliveries": {
          const results = await syncPendingDeliveries(30);
          const updated = results.reduce((a, r) => a + r.updated, 0);
          if (updated > 0) console.log(`[cron:delivery] ${updated} پیام به‌روزرسانی شد`);
          return { updated };
        }

        case "poll-inbox": {
          const r = await pollInbox();
          if (r.scanned > 0) {
            console.log(`[cron:inbox] ${r.scanned} پیام بررسی شد · ${r.optedOut} لغو`);
          }
          return r;
        }

        case "finalize-campaigns": {
          const n = await finalizeCampaigns();
          if (n > 0) console.log(`[cron:campaign] ${n} کمپین تمام شد`);
          return { finished: n };
        }

        default:
          console.warn(`[cron] کار ناشناخته: ${job.name}`);
          return null;
      }
    },
    {
      connection: redis,
      prefix: QUEUE_PREFIX,
      concurrency: 1,
    }
  );

  cronWorker.on("failed", (job, err) => {
    console.error(`[cron] ❌ ${job?.name} — ${err.message}`);
  });

  await registerCronJobs();

  console.log(`[worker] آماده — همزمانی ${CONCURRENCY}`);

  // ── خاموشی تمیز ─────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    console.log(`[worker] دریافت ${signal} — در حال خاموش شدن...`);
    await Promise.all([smsWorker.close(), statusWorker.close(), cronWorker.close()]);
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